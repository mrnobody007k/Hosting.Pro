import { expect, test, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { getClientIp } from '../lib/security'
import { checkLoginAttemptLimit, finalizeLoginAttempt, getLoginAttemptBuckets, recordFailedLogin } from '../lib/login-rate-limit'

const identifierPrefix = `rate-limit-${randomUUID()}`
const firstIdentifier = `${identifierPrefix}-first@example.test`
const secondIdentifier = `${identifierPrefix}-second@example.test`
const genuineTestIp = `2001:db8:${randomUUID().replaceAll('-', '').slice(0, 8)}::42`
const sequentialTestIp = `2001:db8:${randomUUID().replaceAll('-', '').slice(0, 8)}::42`
const concurrentTestIp = `2001:db8:${randomUUID().replaceAll('-', '').slice(0, 8)}::42`
const trustedTestIp = `2001:db8:${randomUUID().replaceAll('-', '').slice(0, 8)}::42`
const successfulRaceTestIp = `2001:db8:${randomUUID().replaceAll('-', '').slice(0, 8)}::42`
const exceptionTestIp = `2001:db8:${randomUUID().replaceAll('-', '').slice(0, 8)}::42`
const userAccessToken = process.env.E2E_USER_ACCESS_TOKEN!
let prisma: PrismaClient

function localTestDatabaseUrl() {
  const contents = readFileSync(path.join(process.cwd(), '.env.local.test'), 'utf8')
  const value = contents.match(/^\s*LOCAL_TEST_DATABASE_URL\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^(['"])(.*)\1$/, '$2')
  if (!value) throw new Error('Login rate-limit tests require the local disposable database configuration.')
  const url = new URL(value)
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '::1'].includes(url.hostname.toLowerCase().replace(/^\[|\]$/g, '')) || decodeURIComponent(url.pathname.replace(/^\//, '')) !== 'housingpro_test' || url.searchParams.has('host')) {
    throw new Error('Login rate-limit tests only allow the disposable local housingpro_test database.')
  }
  return value
}

async function postLogin(page: Page, baseURL: string, identifier: string, forwardedIp?: string) {
  return page.request.post(`${baseURL}/api/auth/login`, {
    data: { identifier, password: 'intentionally-wrong-password', expectedRole: 'USER', accessToken: userAccessToken },
    headers: {
      Origin: baseURL,
      ...(forwardedIp ? { 'x-forwarded-for': forwardedIp } : {}),
    },
  })
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(() => {
  prisma = new PrismaClient({ datasourceUrl: localTestDatabaseUrl() })
})

test.afterAll(async () => {
  if (prisma) {
    await prisma.loginAttempt.deleteMany({ where: { OR: [
      { key: { startsWith: `login:${identifierPrefix}` } },
      { key: { in: [genuineTestIp, sequentialTestIp, concurrentTestIp, trustedTestIp, successfulRaceTestIp, exceptionTestIp].map((ip) => `ip:${ip}`) } },
    ] } })
    await prisma.$disconnect()
  }
})

test('a genuine failed login records one identifier failure', async ({ page }) => {
  const baseURL = String(test.info().project.use.baseURL)
  const key = getLoginAttemptBuckets(firstIdentifier, genuineTestIp)[0].key
  const before = await prisma.loginAttempt.count({ where: { key } })
  expect((await postLogin(page, baseURL, firstIdentifier, genuineTestIp)).status()).toBe(401)
  expect(await prisma.loginAttempt.count({ where: { key } })).toBe(before + 1)
})

test('a successful request clears only prior failures, not a concurrent failure', async () => {
  const buckets = getLoginAttemptBuckets(`${identifierPrefix}-concurrent-success@example.test`, successfulRaceTestIp)
  const successSnapshot = await checkLoginAttemptLimit(prisma, buckets)
  expect(successSnapshot.allowed).toBe(true)
  expect(successSnapshot.identifierAttemptIds).toEqual([])

  const [recorded, successful] = await Promise.all([
    recordFailedLogin(prisma, buckets),
    finalizeLoginAttempt(prisma, buckets, successSnapshot, async () => true),
  ])
  expect(recorded).toBe(true)
  expect(successful.authenticated).toBe(true)

  expect(await prisma.loginAttempt.count({ where: { key: buckets[0].key } })).toBe(1)
})

test('an authentication exception before failure finalization records no attempt', async () => {
  const buckets = getLoginAttemptBuckets(`${identifierPrefix}-exception@example.test`, exceptionTestIp)
  const check = await checkLoginAttemptLimit(prisma, buckets)
  expect(check.allowed).toBe(true)
  await expect(finalizeLoginAttempt(prisma, buckets, check, async () => {
    throw new Error('simulated credential verification failure')
  })).rejects.toThrow('simulated credential verification failure')
  expect(await prisma.loginAttempt.count({ where: { key: buckets[0].key } })).toBe(0)
})

test('sequential failed logins reach the existing identifier threshold', async ({ page }) => {
  const baseURL = String(test.info().project.use.baseURL)
  for (let attempt = 0; attempt < 10; attempt += 1) {
    expect((await postLogin(page, baseURL, firstIdentifier, sequentialTestIp)).status()).toBe(401)
  }
  expect((await postLogin(page, baseURL, firstIdentifier, sequentialTestIp)).status()).toBe(429)
  expect((await postLogin(page, baseURL, secondIdentifier, sequentialTestIp)).status()).toBe(401)
})

test('concurrent failures cannot all pass the identifier threshold', async ({ page }) => {
  const baseURL = String(test.info().project.use.baseURL)
  const concurrentIdentifier = `${identifierPrefix}-concurrent@example.test`
  const responses = await Promise.all(Array.from({ length: 16 }, () => postLogin(page, baseURL, concurrentIdentifier, concurrentTestIp)))
  const statuses = responses.map((response) => response.status())
  expect(statuses.filter((status) => status === 401)).toHaveLength(10)
  expect(statuses.filter((status) => status === 429)).toHaveLength(6)
})

test('trusted client IP threshold is shared across identifiers', async ({ page }) => {
  const baseURL = String(test.info().project.use.baseURL)
  for (let identifierIndex = 0; identifierIndex < 3; identifierIndex += 1) {
    const identifier = `${identifierPrefix}-ip-${identifierIndex}@example.test`
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect((await postLogin(page, baseURL, identifier, trustedTestIp)).status()).toBe(401)
    }
  }
  const blocked = await postLogin(page, baseURL, `${identifierPrefix}-ip-final@example.test`, trustedTestIp)
  expect(blocked.status()).toBe(429)
})

test('identifier limits are scoped per identifier and unknown IPs have no shared bucket', () => {
  const originalTrustProxy = process.env.TRUST_PROXY
  try {
    delete process.env.TRUST_PROXY
    const unknown = getClientIp(new Request('https://housing.test', { headers: { 'x-forwarded-for': '203.0.113.8' } }))
    expect(unknown).toBe('unknown')
    const unknownBuckets = getLoginAttemptBuckets('person@example.test', unknown)
    expect(unknownBuckets.map((bucket) => bucket.key)).toEqual(['login:person@example.test|ip:unknown'])
    expect(getLoginAttemptBuckets('other@example.test', unknown)[0].key).not.toBe(unknownBuckets[0].key)

    process.env.TRUST_PROXY = 'true'
    const trusted = getClientIp(new Request('https://housing.test', { headers: { 'x-forwarded-for': '203.0.113.8, 10.0.0.2' } }))
    expect(trusted).toBe('203.0.113.8')
    expect(getLoginAttemptBuckets('person@example.test', trusted).map((bucket) => bucket.key)).toEqual([
      'login:person@example.test|ip:203.0.113.8',
      'ip:203.0.113.8',
    ])
  } finally {
    if (originalTrustProxy === undefined) delete process.env.TRUST_PROXY
    else process.env.TRUST_PROXY = originalTrustProxy
  }
})
