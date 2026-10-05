import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  checkLoginAttemptLimit,
  finalizeLoginAttempt,
  getLoginAttemptBuckets,
} from '../lib/login-rate-limit'

function createLoginAttemptDatabase() {
  const rows: Array<{ id: string; key: string; createdAt: Date }> = []
  let nextId = 0

  async function deleteMany({ where }: any) {
    const before = rows.length
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      const row = rows[index]
      if (where.createdAt?.lt && row.createdAt < where.createdAt.lt) rows.splice(index, 1)
      else if (where.id?.in && where.id.in.includes(row.id) && where.key?.in?.includes(row.key)) rows.splice(index, 1)
    }
    return { count: before - rows.length }
  }

  const loginAttempt = {
    deleteMany,
    count: async ({ where }: any) => rows.filter((row) => row.key === where.key && row.createdAt >= where.createdAt.gte).length,
    findMany: async ({ where }: any) => rows.filter((row) => where.key.in.includes(row.key) && row.createdAt >= where.createdAt.gte).map(({ id }) => ({ id })),
    createMany: async ({ data }: any) => {
      for (const { key } of data) rows.push({ id: `attempt-${++nextId}`, key, createdAt: new Date() })
      return { count: data.length }
    },
  }
  const tx = { loginAttempt, $queryRaw: async () => [] }
  return {
    rows,
    database: {
      loginAttempt,
      $transaction: async (callback: (transaction: typeof tx) => unknown) => callback(tx),
    } as any,
  }
}

test('rejected User/Manager access checks consume the same failed-login budget', async () => {
  const { database, rows } = createLoginAttemptDatabase()
  const buckets = getLoginAttemptBuckets('client@example.test', '192.0.2.20')

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const check = await checkLoginAttemptLimit(database, buckets)
    assert.equal(check.allowed, true)
    const result = await finalizeLoginAttempt(database, buckets, check, async () => false)
    assert.deepEqual(result, { authenticated: false, rateLimited: false })
  }

  assert.equal(rows.filter((row) => row.key === buckets[0].key).length, 10)
  assert.equal((await checkLoginAttemptLimit(database, buckets)).allowed, false)
})

test('login endpoint rate-limits before reading access-token settings and records rejected access checks', () => {
  const route = readFileSync(new URL('../app/api/auth/login/route.ts', import.meta.url), 'utf8')
  const limitCheck = route.indexOf('const attemptCheck = await checkLoginAttemptLimit')
  const accessSettingRead = route.indexOf('prisma.platformSetting.findFirst')
  const accessTokenCheck = route.indexOf('if (!matchesAccessToken(body.accessToken, requiredToken))')

  assert.ok(limitCheck >= 0 && limitCheck < accessSettingRead)
  assert.ok(accessSettingRead < accessTokenCheck)
  assert.match(route.slice(accessTokenCheck), /finalizeLoginAttempt\(prisma, loginBuckets, attemptCheck, async \(\) => false\)/)
})
