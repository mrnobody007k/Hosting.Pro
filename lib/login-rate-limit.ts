import { Prisma, PrismaClient } from '@prisma/client'

const WINDOW_MS = 15 * 60 * 1000
const MAX_IDENTIFIER_IP_FAILURES = 10
const MAX_IP_FAILURES = 30

type Database = PrismaClient

export type LoginAttemptBucket = {
  key: string
  limit: number
  clearOnSuccess?: boolean
}

export type LoginAttemptCheck = {
  allowed: boolean
  identifierAttemptIds: string[]
}

export function getLoginAttemptBuckets(identifier: string, ip: string): LoginAttemptBucket[] {
  const identifierKey = `login:${identifier}|ip:${ip}`
  const buckets: LoginAttemptBucket[] = [
    { key: identifierKey, limit: MAX_IDENTIFIER_IP_FAILURES, clearOnSuccess: true },
  ]
  if (ip !== 'unknown') buckets.push({ key: `ip:${ip}`, limit: MAX_IP_FAILURES })
  return buckets
}

async function lockBuckets(tx: Prisma.TransactionClient, buckets: LoginAttemptBucket[]) {
  const orderedBuckets = [...buckets].sort((a, b) => a.key.localeCompare(b.key))
  for (const bucket of orderedBuckets) {
    await tx.$queryRaw`WITH lock AS MATERIALIZED (SELECT pg_advisory_xact_lock(hashtextextended(${bucket.key}, 0))) SELECT 'locked'::text FROM lock`
  }
  return orderedBuckets
}

function getCutoff() {
  return new Date(Date.now() - WINDOW_MS)
}

/** Check current limits under short-lived locks and capture only prior identifier failures. */
export async function checkLoginAttemptLimit(database: Database, buckets: LoginAttemptBucket[]): Promise<LoginAttemptCheck> {
  const cutoff = getCutoff()
  return database.$transaction(async (tx) => {
    await tx.loginAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } })
    const orderedBuckets = await lockBuckets(tx, buckets)

    for (const bucket of orderedBuckets) {
      const failures = await tx.loginAttempt.count({ where: { key: bucket.key, createdAt: { gte: cutoff } } })
      if (failures >= bucket.limit) return { allowed: false, identifierAttemptIds: [] }
    }

    const identifierKeys = orderedBuckets.filter((bucket) => bucket.clearOnSuccess).map((bucket) => bucket.key)
    const priorIdentifierAttempts = identifierKeys.length
      ? await tx.loginAttempt.findMany({
          where: { key: { in: identifierKeys }, createdAt: { gte: cutoff } },
          select: { id: true },
        })
      : []

    return { allowed: true, identifierAttemptIds: priorIdentifierAttempts.map((attempt) => attempt.id) }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })
}

/** Record a genuine failed login, serializing the check and insert across all buckets. */
export async function recordFailedLogin(database: Database, buckets: LoginAttemptBucket[]): Promise<boolean> {
  const cutoff = getCutoff()
  return database.$transaction(async (tx) => {
    await tx.loginAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } })
    const orderedBuckets = await lockBuckets(tx, buckets)

    for (const bucket of orderedBuckets) {
      const failures = await tx.loginAttempt.count({ where: { key: bucket.key, createdAt: { gte: cutoff } } })
      if (failures >= bucket.limit) return false
    }

    await tx.loginAttempt.createMany({ data: orderedBuckets.map(({ key }) => ({ key })) })
    return true
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })
}

/**
 * Preserve the existing successful-login reset for prior identifier failures,
 * while deleting only IDs observed before this request verified credentials.
 * Failed attempts recorded concurrently after that snapshot are never removed.
 */
export async function clearPriorIdentifierFailures(database: Database, buckets: LoginAttemptBucket[], attemptIds: string[]) {
  const identifierKeys = buckets.filter((bucket) => bucket.clearOnSuccess).map((bucket) => bucket.key)
  if (!identifierKeys.length || !attemptIds.length) return
  await database.loginAttempt.deleteMany({
    where: { id: { in: attemptIds }, key: { in: identifierKeys } },
  })
}

/** Verify credentials without database locks, then finalize only the actual outcome. */
export async function finalizeLoginAttempt(
  database: Database,
  buckets: LoginAttemptBucket[],
  check: LoginAttemptCheck,
  verifyCredentials: () => Promise<boolean>,
) {
  const authenticated = await verifyCredentials()
  if (authenticated) {
    await clearPriorIdentifierFailures(database, buckets, check.identifierAttemptIds)
    return { authenticated: true as const, rateLimited: false as const }
  }

  const recorded = await recordFailedLogin(database, buckets)
  return { authenticated: false as const, rateLimited: !recorded }
}
