import assert from 'node:assert/strict'
import test from 'node:test'
import { findLoginAccountByEmail, verifyLoginAccount, type LoginAccount, type LoginRole } from '../lib/login-account'

type LookupRow = { id: string; email: string; status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED'; passwordHash: string; managerId?: string }
type Table = 'adminUser' | 'manager' | 'user'

function mockDatabase(rows: Partial<Record<Table, LookupRow[]>>, missingUserDisplayTier = false) {
  const calls: Array<{ table: Table; select: Record<string, boolean> }> = []
  const delegate = (table: Table) => ({
    findUnique: async ({ where, select }: { where: { email: string }; select: Record<string, boolean> }) => {
      calls.push({ table, select })
      if (!select || Object.keys(select).length === 0) throw new Error(`${table} query selected all scalar fields`)
      if (missingUserDisplayTier && table === 'user' && 'displayTier' in select) {
        throw new Error('P2022: column User.displayTier does not exist')
      }
      const row = rows[table]?.find((candidate) => candidate.email === where.email)
      if (!row) return null
      const projected: Record<string, unknown> = {}
      for (const field of Object.keys(select)) {
        if (field in row) projected[field] = row[field as keyof LookupRow]
      }
      return projected
    },
  })
  return {
    database: {
      adminUser: delegate('adminUser'),
      manager: delegate('manager'),
      user: delegate('user'),
    } as never,
    calls,
  }
}

test('Admin lookup succeeds when User.displayTier is absent and keeps collision check narrow', async () => {
  const { database, calls } = mockDatabase({
    adminUser: [{ id: 'admin-id', email: 'admin@example.test', status: 'ACTIVE', passwordHash: 'admin-hash' }],
  }, true)

  const result = await findLoginAccountByEmail(database, 'admin@example.test', 'ADMIN')
  const authenticated = await verifyLoginAccount(result.account, 'ADMIN', 'correct-password', async (plain, hash) =>
    plain === 'correct-password' && hash === 'admin-hash'
  )

  assert.equal(result.collision, false)
  assert.deepEqual(result.account, { id: 'admin-id', status: 'ACTIVE', passwordHash: 'admin-hash', role: 'ADMIN' })
  assert.equal(authenticated, true)
  assert.deepEqual(calls.find((call) => call.table === 'user')?.select, { id: true })
  assert.deepEqual(calls.find((call) => call.table === 'adminUser')?.select, { id: true, status: true, passwordHash: true })
})

test('email lookup rejects a cross-role duplicate while querying only IDs for unrelated roles', async () => {
  const { database, calls } = mockDatabase({
    adminUser: [{ id: 'admin-id', email: 'same@example.test', status: 'ACTIVE', passwordHash: 'admin-hash' }],
    user: [{ id: 'user-id', email: 'same@example.test', status: 'ACTIVE', passwordHash: 'user-hash', managerId: 'manager-id' }],
  })

  const result = await findLoginAccountByEmail(database, 'same@example.test', 'ADMIN')

  assert.equal(result.collision, true)
  assert.equal(result.account, null)
  assert.deepEqual(calls.find((call) => call.table === 'user')?.select, { id: true })
})

test('an account found only in a different role cannot authenticate as Admin', async () => {
  const { database } = mockDatabase({
    manager: [{ id: 'manager-id', email: 'manager@example.test', status: 'ACTIVE', passwordHash: 'manager-hash' }],
  })
  const result = await findLoginAccountByEmail(database, 'manager@example.test', 'ADMIN')

  assert.equal(result.collision, false)
  assert.equal(result.account, null)
  assert.equal(await verifyLoginAccount(result.account, 'ADMIN', 'manager-password', async () => true), false)
})

test('wrong password and inactive Admin are rejected', async () => {
  const activeAdmin: LoginAccount = { id: 'admin', status: 'ACTIVE', passwordHash: 'stored', role: 'ADMIN' }
  const inactiveAdmin: LoginAccount = { ...activeAdmin, status: 'DISABLED' }

  assert.equal(await verifyLoginAccount(activeAdmin, 'ADMIN', 'wrong', async () => false), false)
  assert.equal(await verifyLoginAccount(inactiveAdmin, 'ADMIN', 'correct', async () => true), false)
  assert.equal(await verifyLoginAccount(activeAdmin, 'USER' as LoginRole, 'correct', async () => true), false)
})

test('valid credentials authenticate only the expected active role', async () => {
  const admin: LoginAccount = { id: 'admin', status: 'ACTIVE', passwordHash: 'stored', role: 'ADMIN' }
  assert.equal(await verifyLoginAccount(admin, 'ADMIN', 'correct', async (plain, hash) => plain === 'correct' && hash === 'stored'), true)
})
