import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { generateAccessToken, storeAccessToken } from "../lib/access-token";

const fixtureAccounts = {
  admin: { name: "Housing.pro Test Admin", email: "test-admin@housing.pro" },
  manager: { name: "Housing.pro Test Manager One", email: "test-manager-one@housing.pro" },
  customer: { name: "Housing.pro Test Customer One", email: "test-customer-one@housing.pro" },
} as const;

function requireLocalTestDatabase(value: string | undefined): string {
  if (!value) throw new Error("LOCAL_TEST_DATABASE_URL is missing from .env.local.test.");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("LOCAL_TEST_DATABASE_URL is not a valid PostgreSQL URL.");
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (
    !["localhost", "127.0.0.1"].includes(host) ||
    databaseName !== "housingpro_test" ||
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    url.searchParams.has("host")
  ) {
    throw new Error("Refusing to run: credentials can only be set on local PostgreSQL database housingpro_test at localhost or 127.0.0.1.");
  }
  return value;
}

function readLocalTestDatabaseUrl(): string {
  const envPath = path.join(process.cwd(), ".env.local.test");
  let localEnv: string;
  try {
    localEnv = readFileSync(envPath, "utf8");
  } catch {
    throw new Error("Create .env.local.test with LOCAL_TEST_DATABASE_URL for the disposable local database.");
  }

  const raw = localEnv.match(/^\s*LOCAL_TEST_DATABASE_URL\s*=\s*(.*?)\s*$/m)?.[1];
  return requireLocalTestDatabase(raw?.replace(/^(['"])(.*)\1$/, "$2"));
}

async function main() {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Refusing to run unless NODE_ENV is exactly development.");
  }
  if (process.env.ALLOW_HOUSINGPRO_LOCAL_E2E_SETUP !== "YES") {
    throw new Error("Explicit opt-in required: ALLOW_HOUSINGPRO_LOCAL_E2E_SETUP=YES.");
  }

  const databaseUrl = readLocalTestDatabaseUrl();
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });

  try {
    // Require one exact existing fixture account of each kind before changing credentials.
    const [admins, managers, customers] = await Promise.all([
      prisma.adminUser.findMany({ where: { email: fixtureAccounts.admin.email, name: fixtureAccounts.admin.name }, select: { id: true, email: true } }),
      prisma.manager.findMany({ where: { email: fixtureAccounts.manager.email, name: fixtureAccounts.manager.name }, select: { id: true, email: true } }),
      prisma.user.findMany({ where: { email: fixtureAccounts.customer.email, name: fixtureAccounts.customer.name }, select: { id: true, email: true } }),
    ]);
    if (admins.length !== 1 || managers.length !== 1 || customers.length !== 1) {
      throw new Error("Expected exactly one existing fictional test Admin, Manager One, and Customer One. No credentials were changed.");
    }

    const credentials = {
      admin: randomBytes(24).toString("base64url"),
      manager: randomBytes(24).toString("base64url"),
      customer: randomBytes(24).toString("base64url"),
    };
    const [adminHash, managerHash, customerHash] = await Promise.all([
      bcrypt.hash(credentials.admin, 12),
      bcrypt.hash(credentials.manager, 12),
      bcrypt.hash(credentials.customer, 12),
    ]);
    const managerToken = generateAccessToken();
    const customerToken = generateAccessToken();

    const secretsPath = path.join(process.cwd(), ".env.local.e2e");
    const secrets = {
      E2E_ADMIN_PASSWORD: credentials.admin,
      E2E_MANAGER_PASSWORD: credentials.manager,
      E2E_USER_PASSWORD: credentials.customer,
      E2E_MANAGER_ACCESS_TOKEN: managerToken,
      E2E_USER_ACCESS_TOKEN: customerToken,
    };

    await prisma.$transaction(async (tx) => {
      await tx.adminUser.update({ where: { id: admins[0].id }, data: { passwordHash: adminHash } });
      await tx.manager.update({ where: { id: managers[0].id }, data: { passwordHash: managerHash } });
      await tx.user.update({ where: { id: customers[0].id }, data: { passwordHash: customerHash } });

      const setting = await tx.platformSetting.findFirst({ orderBy: { updatedAt: "desc" }, select: { id: true } });
      const tokenHashes = {
        managerLoginAccessToken: storeAccessToken(managerToken),
        customerLoginAccessToken: storeAccessToken(customerToken),
      };
      if (setting) {
        await tx.platformSetting.update({ where: { id: setting.id }, data: tokenHashes });
      } else {
        await tx.platformSetting.create({ data: tokenHashes });
      }
    });

    writeFileSync(
      secretsPath,
      `${Object.entries(secrets).map(([key, value]) => `${key}=${value}`).join("\n")}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    console.log("Local Housing.pro E2E credentials generated and saved to .env.local.e2e.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown local E2E setup error.";
  // Avoid printing connection strings or generated secrets from unexpected errors.
  const safeMessage = message.replace(/(?:postgres(?:ql)?:\/\/)[^\s]+/gi, "[redacted database URL]");
  console.error(safeMessage);
  process.exitCode = 1;
});
