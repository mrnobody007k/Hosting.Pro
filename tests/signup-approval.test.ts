import assert from 'node:assert/strict'
import test from 'node:test'
import { approveSignup, approveSignupTransaction, SIGNUP_WELCOME_BALANCE } from '../lib/signup-approval'

function createApprovalState() {
  return {
    status: 'PENDING',
    balance: 25,
    transactions: [] as any[],
    audits: [] as any[],
    notifications: [] as any[],
  }
}

function createApprovalTransaction(state: ReturnType<typeof createApprovalState>, walletExists = true) {
  const tx: any = {
    user: {
      findFirst: async ({ where }: any) => where.id === 'user-1' && (!where.managerId || where.managerId === 'manager-1')
        ? { id: 'user-1', name: 'Test User', managerId: 'manager-1', signupStatus: state.status }
        : null,
      updateMany: async ({ where, data }: any) => {
        if (where.id !== 'user-1' || (where.managerId && where.managerId !== 'manager-1') || state.status !== 'PENDING') return { count: 0 }
        state.status = data.signupStatus
        return { count: 1 }
      },
    },
    wallet: {
      findUnique: async () => walletExists ? ({ balance: String(state.balance) }) : null,
      update: async ({ data }: any) => { state.balance += Number(data.balance.increment.toString()) },
    },
    transaction: {
      findFirst: async ({ where }: any) => state.transactions.find((row) => row.userId === where.userId && row.type === where.type && row.reference === where.reference) || null,
      create: async ({ data }: any) => { state.transactions.push(data) },
    },
    auditLog: { create: async ({ data }: any) => { state.audits.push(data) } },
    notification: { create: async ({ data }: any) => { state.notifications.push(data) } },
  }
  return tx
}

function createApprovalFixture() {
  const state = createApprovalState()
  return { state, tx: createApprovalTransaction(state) }
}

function createTransactionalFixture(walletExists = true, initialTransactions: any[] = []) {
  const state = createApprovalState()
  state.transactions.push(...initialTransactions)
  return {
    state,
    prisma: {
      $transaction: async (callback: (tx: any) => unknown) => {
        const draft = structuredClone(state)
        const result = await callback(createApprovalTransaction(draft, walletExists))
        Object.assign(state, draft)
        return result
      },
    } as any,
  }
}

test('signup approval records the one-time ₹120 credit and associated effects for Super Admin', async () => {
  const { state, tx } = createApprovalFixture()
  const result = await approveSignup(tx, 'user-1', { type: 'ADMIN', id: 'admin-1' }, new Date('2026-10-02T00:00:00Z'))

  assert.equal(SIGNUP_WELCOME_BALANCE, '120.00')
  assert.equal(state.status, 'APPROVED')
  assert.equal(state.balance, 145)
  assert.equal(result.balanceAfter.toFixed(2), '145.00')
  assert.equal(state.transactions.length, 1)
  assert.equal(state.transactions[0].reference, 'day1-welcome:user-1')
  assert.equal(state.transactions[0].type, 'WELCOME_BONUS')
  assert.equal(state.transactions[0].amount.toFixed(2), '120.00')
  assert.equal(state.transactions[0].balanceBefore.toFixed(2), '25.00')
  assert.equal(state.transactions[0].balanceAfter.toFixed(2), '145.00')
  assert.equal(state.audits.length, 1)
  assert.equal(state.audits[0].actorType, 'ADMIN')
  assert.equal(state.audits[0].actorId, 'admin-1')
  assert.equal(state.audits[0].managerId, 'manager-1')
  assert.equal(state.audits[0].action, 'ADMIN_USER_SIGNUP_APPROVED')
  assert.equal(state.audits[0].targetType, 'USER')
  assert.equal(state.audits[0].targetId, 'user-1')
  assert.equal(state.audits[0].amount.toFixed(2), '120.00')
  assert.equal(state.notifications.length, 1)
})

test('Manager approval audit records the authenticated Manager actor', async () => {
  const { state, tx } = createApprovalFixture()

  await approveSignup(tx, 'user-1', { type: 'MANAGER', id: 'manager-user-1', managerId: 'manager-1' })

  assert.equal(state.status, 'APPROVED')
  assert.equal(state.balance, 145)
  assert.equal(state.transactions.length, 1)
  assert.equal(state.audits.length, 1)
  assert.equal(state.audits[0].actorType, 'MANAGER')
  assert.equal(state.audits[0].actorId, 'manager-user-1')
  assert.equal(state.audits[0].managerId, 'manager-1')
  assert.equal(state.audits[0].action, 'USER_SIGNUP_APPROVED')
  assert.equal(state.audits[0].targetType, 'USER')
  assert.equal(state.audits[0].targetId, 'user-1')
})

test('repeat approvals fail and overlapping in-memory claims cannot duplicate effects', async () => {
  const { state, tx } = createApprovalFixture()
  const actor = { type: 'ADMIN' as const, id: 'admin-1' }
  const first = await approveSignup(tx, 'user-1', actor)
  await assert.rejects(approveSignup(tx, 'user-1', actor), /SIGNUP_ALREADY_PROCESSED/)
  assert.equal(first.balanceAfter.toFixed(2), '145.00')

  const concurrent = createApprovalFixture()
  const results = await Promise.allSettled([
    approveSignup(concurrent.tx, 'user-1', actor),
    approveSignup(concurrent.tx, 'user-1', { type: 'MANAGER', id: 'manager-user-1', managerId: 'manager-1' }),
  ])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1)
  assert.equal(concurrent.state.balance, 145)
  assert.equal(concurrent.state.transactions.length, 1)
  assert.equal(concurrent.state.audits.length, 1)
  assert.equal(concurrent.state.notifications.length, 1)
})

test('manager approvals remain scoped to the assigned manager', async () => {
  const { tx } = createApprovalFixture()
  await assert.rejects(
    approveSignup(tx, 'user-1', { type: 'MANAGER', id: 'other-manager-user', managerId: 'manager-2' }),
    /USER_NOT_FOUND/,
  )
})

test('a failed approval rolls back the claimed signup and every wallet side effect', async () => {
  const { state, prisma } = createTransactionalFixture(false)
  await assert.rejects(
    approveSignupTransaction(prisma, 'user-1', { type: 'ADMIN', id: 'admin-1' }),
    /USER_WALLET_NOT_FOUND/,
  )
  assert.equal(state.status, 'PENDING')
  assert.equal(state.balance, 25)
  assert.equal(state.transactions.length, 0)
  assert.equal(state.audits.length, 0)
  assert.equal(state.notifications.length, 0)
})

test('a pending signup with an existing welcome reference is rejected without duplicate effects', async () => {
  const existing = {
    id: 'prior-welcome',
    userId: 'user-1',
    type: 'WELCOME_BONUS',
    reference: 'day1-welcome:user-1',
  }
  const { state, prisma } = createTransactionalFixture(true, [existing])

  await assert.rejects(
    approveSignupTransaction(prisma, 'user-1', { type: 'ADMIN', id: 'admin-1' }),
    /WELCOME_CREDIT_ALREADY_EXISTS/,
  )

  assert.equal(state.status, 'PENDING')
  assert.equal(state.balance, 25)
  assert.equal(state.transactions.length, 1)
  assert.equal(state.audits.length, 0)
  assert.equal(state.notifications.length, 0)
})

test('serialization conflicts retry within a fixed bound and then fail safely', async () => {
  const fixture = createTransactionalFixture()
  let attempts = 0
  const prisma: any = {
    $transaction: async (callback: (tx: any) => unknown) => {
      attempts += 1
      if (attempts < 3) throw Object.assign(new Error('serialization conflict'), { code: 'P2034' })
      return callback(createApprovalTransaction(fixture.state))
    },
  }
  const result = await approveSignupTransaction(prisma, 'user-1', { type: 'ADMIN', id: 'admin-1' })
  assert.equal(attempts, 3)
  assert.equal(result.balanceAfter.toFixed(2), '145.00')
  assert.equal(fixture.state.transactions.length, 1)

  let exhaustedAttempts = 0
  await assert.rejects(
    approveSignupTransaction({ $transaction: async () => { exhaustedAttempts += 1; throw Object.assign(new Error('serialization conflict'), { code: 'P2034' }) } } as any, 'user-1', { type: 'ADMIN', id: 'admin-1' }),
    /SIGNUP_APPROVAL_CONFLICT/,
  )
  assert.equal(exhaustedAttempts, 3)
})
