import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const fixtureAccounts = [
  { role: "ADMIN", name: "Housing.pro Test Admin", email: "test-admin@housing.pro" },
  { role: "MANAGER", name: "Housing.pro Test Manager One", email: "test-manager-one@housing.pro" },
  { role: "MANAGER", name: "Housing.pro Test Manager Two", email: "test-manager-two@housing.pro" },
  { role: "USER", name: "Housing.pro Test Customer One", email: "test-customer-one@housing.pro" },
  { role: "USER", name: "Housing.pro Test Customer Two", email: "test-customer-two@housing.pro" },
] as const;

function assertLocalTestDatabase(databaseUrl: string | undefined): string {
  if (!databaseUrl) throw new Error("LOCAL_TEST_DATABASE_URL is missing from .env.local.test.");

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("LOCAL_TEST_DATABASE_URL is not a valid PostgreSQL URL.");
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const allowedHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!allowedHosts.has(host) || databaseName !== "housingpro_test") {
    throw new Error("Refusing to run: fixture URL must point to the local housingpro_test database.");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("LOCAL_TEST_DATABASE_URL must use the PostgreSQL protocol.");
  }
  return databaseUrl;
}

async function main() {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Refusing to run unless NODE_ENV is exactly development.");
  }
  if (process.env.ALLOW_HOUSINGPRO_TEST_FIXTURES !== "YES") {
    throw new Error("Explicit opt-in required: ALLOW_HOUSINGPRO_TEST_FIXTURES=YES.");
  }

  const envPath = path.join(process.cwd(), ".env.local.test");
  let localEnv: string;
  try {
    localEnv = readFileSync(envPath, "utf8");
  } catch {
    throw new Error("Create .env.local.test with LOCAL_TEST_DATABASE_URL for the disposable local database.");
  }
  const urlLine = localEnv.match(/^\s*LOCAL_TEST_DATABASE_URL\s*=\s*(.*?)\s*$/m)?.[1];
  const localTestDatabaseUrl = urlLine?.replace(/^(['"])(.*)\1$/, "$2");
  const datasourceUrl = assertLocalTestDatabase(localTestDatabaseUrl);
  const prisma = new PrismaClient({ datasourceUrl });

  try {
    const existingAdmin = await prisma.adminUser.findFirst({
      where: { email: { in: fixtureAccounts.filter((a) => a.role === "ADMIN").map((a) => a.email) } },
      select: { id: true },
    });
    const existingManagers = await prisma.manager.findMany({
      where: { email: { in: fixtureAccounts.filter((a) => a.role === "MANAGER").map((a) => a.email) } },
      select: { id: true },
    });
    const existingCustomers = await prisma.user.findMany({
      where: { email: { in: fixtureAccounts.filter((a) => a.role === "USER").map((a) => a.email) } },
      select: { id: true },
    });
    if (existingAdmin || existingManagers.length || existingCustomers.length) {
      throw new Error("One or more fixture identities already exist. No records were changed.");
    }

    const credentials = fixtureAccounts.map(({ role, email }) => ({
      role,
      email,
      password: randomBytes(24).toString("base64url"),
    }));
    const passwordHashes = await Promise.all(credentials.map(({ password }) => bcrypt.hash(password, 12)));
    const referralCodes = [randomBytes(9).toString("hex"), randomBytes(9).toString("hex")];

    await prisma.$transaction(async (tx) => {
      // Check unique referral values before creating any account; a collision safely aborts.
      const existingReferral = await tx.manager.findFirst({
        where: { referralCode: { in: referralCodes } },
        select: { id: true },
      });
      if (existingReferral) throw new Error("A generated fixture referral code collided; no records were changed.");

      await tx.adminUser.create({
        data: { name: fixtureAccounts[0].name, email: credentials[0].email, passwordHash: passwordHashes[0] },
      });
      const managerOne = await tx.manager.create({
        data: { name: fixtureAccounts[1].name, email: credentials[1].email, passwordHash: passwordHashes[1], referralCode: referralCodes[0] },
      });
      const managerTwo = await tx.manager.create({
        data: { name: fixtureAccounts[2].name, email: credentials[2].email, passwordHash: passwordHashes[2], referralCode: referralCodes[1] },
      });
      await tx.user.create({
        data: { name: fixtureAccounts[3].name, email: credentials[3].email, passwordHash: passwordHashes[3], managerId: managerOne.id },
      });
      await tx.user.create({
        data: { name: fixtureAccounts[4].name, email: credentials[4].email, passwordHash: passwordHashes[4], managerId: managerTwo.id },
      });
    });

    // One-time passwords are only written to this local terminal for the developer running the command.
    console.log("Local Housing.pro test identities created. Save these generated passwords securely:");
    for (const account of credentials) console.log(`${account.role} ${account.email} ${account.password}`);
    console.log("No wallet, ledger, order, task, deposit, withdrawal, or notification records were created.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown fixture setup error.";
  console.error(message);
  process.exitCode = 1;
});
