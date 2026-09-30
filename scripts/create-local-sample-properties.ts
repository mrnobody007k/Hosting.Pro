import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const samples = [
  { title: "[LOCAL SAMPLE] Sea Glass Courtyard", location: "Mumbai, Maharashtra", price: "7800000.00", description: "Original fictional development sample. A compact courtyard residence concept near the western waterfront." },
  { title: "[LOCAL SAMPLE] Neem House Residences", location: "Delhi, NCR", price: "6400000.00", description: "Original fictional development sample. A low-rise homes concept with shaded shared gardens." },
  { title: "[LOCAL SAMPLE] Banyan Square Homes", location: "Bengaluru, Karnataka", price: "5900000.00", description: "Original fictional development sample. A neighborhood housing concept with flexible work areas." },
  { title: "[LOCAL SAMPLE] Pearl Gate Apartments", location: "Hyderabad, Telangana", price: "5200000.00", description: "Original fictional development sample. A mid-rise residential concept with a central open court." },
  { title: "[LOCAL SAMPLE] Copper Leaf Court", location: "Pune, Maharashtra", price: "4700000.00", description: "Original fictional development sample. A walkable residential cluster with planted balconies." },
  { title: "[LOCAL SAMPLE] Aravalli Garden Homes", location: "Gurgaon, Haryana", price: "7100000.00", description: "Original fictional development sample. A family housing concept organized around a green commons." },
  { title: "[LOCAL SAMPLE] Blue Kite Enclave", location: "Noida, Uttar Pradesh", price: "4300000.00", description: "Original fictional development sample. A practical apartment concept with shared community rooms." },
  { title: "[LOCAL SAMPLE] Coral Line Residences", location: "Chennai, Tamil Nadu", price: "4900000.00", description: "Original fictional development sample. A coastal city housing concept with shaded circulation." },
];

function requireDisposableLocalUrl(value: string | undefined): string {
  if (!value) throw new Error("LOCAL_TEST_DATABASE_URL is missing from .env.local.test.");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("The local fixture database URL is invalid."); }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!["localhost", "127.0.0.1", "::1"].includes(host) || databaseName !== "housingpro_test" || !["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("Refusing to run: sample properties are restricted to local PostgreSQL database housingpro_test.");
  }
  return value;
}

async function main() {
  if (process.env.NODE_ENV !== "development" || process.env.HOUSINGPRO_CREATE_LOCAL_SAMPLE_PROPERTIES !== "YES") {
    throw new Error("Refusing to run without development mode and explicit local-fixture opt-in.");
  }
  const envPath = path.join(process.cwd(), ".env.local.test");
  let localEnv: string;
  try { localEnv = readFileSync(envPath, "utf8"); } catch { throw new Error("Create .env.local.test for the disposable local fixture database first."); }
  const raw = localEnv.match(/^\s*LOCAL_TEST_DATABASE_URL\s*=\s*(.*?)\s*$/m)?.[1];
  const databaseUrl = requireDisposableLocalUrl(raw?.replace(/^(['"])(.*)\1$/, "$2"));
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    const existing = await prisma.property.findMany({ where: { title: { in: samples.map((property) => property.title) } }, select: { title: true } });
    const existingTitles = new Set(existing.map((property) => property.title));
    const missing = samples.filter((property) => !existingTitles.has(property.title));
    if (missing.length) await prisma.property.createMany({ data: missing.map((property) => ({ ...property, status: "ACTIVE" as const })) });
    console.log(`Local-only fictional property fixtures ready (${samples.length} expected, ${missing.length} added). No remote URL or secret is printed.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Local sample-property fixture failed.");
  process.exitCode = 1;
});
