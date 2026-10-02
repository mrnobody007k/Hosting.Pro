import assert from 'node:assert/strict'
import test from 'node:test'
import { Decimal } from 'decimal.js'
import { parseFinalReturnAmount, settleReRentTask } from '../lib/rerent-settlement.mjs'
import { getReRentCandidatesWhere, processReRentBatch } from '../lib/rerent-scheduler'

function createStore({ managerId = 'manager-1', taskStatus = 'SUBMITTED', orderStatus = 'RE_RENT_PENDING', balance = '400.00', delay = 0 } = {}) {
  const now = new Date('2026-10-01T00:00:00.000Z')
  const task = {
    id: 'task-1', userId: 'user-1', managerId, type: 'RE_RENT', status: taskStatus,
    submittedAt: new Date(now.getTime() - 10_000), profitRate: new Decimal('1.20'), profitAmount: new Decimal(0),
    order: {
      id: 'order-1', userId: 'user-1', managerId, orderCode: 'HP-1', amount: new Decimal('100.00'),
      status: orderStatus, paymentStatus: 'PAID', paymentVerifiedAt: now, finalReturnAmount: null,
      profit: new Decimal(0),
    },
    user: { id: 'user-1', managerId, status: 'ACTIVE', signupStatus: 'APPROVED', manager: { status: 'ACTIVE' } },
  }
  const wallet = { userId: 'user-1', balance: new Decimal(balance) }
  const transactions: any[] = []
  const notifications: any[] = []
  const auditLogs: any[] = []
  let lock = Promise.resolve()
  const tx = {
    task: {
      findFirst: async ({ where }: any) => where.managerId !== managerId ? null : task,
      updateMany: async ({ where, data }: any) => {
        if (where.id !== task.id || where.managerId !== managerId || !where.status.in.includes(task.status)) return { count: 0 }
        Object.assign(task, data)
        return { count: 1 }
      },
    },
    platformSetting: { findFirst: async () => ({ rerentDelaySeconds: delay }) },
    transaction: {
      findFirst: async ({ where }: any) => transactions.find((item) => item.reference === where.reference && item.type === where.type) || null,
      create: async ({ data }: any) => { transactions.push(data); return data },
    },
    wallet: {
      findUnique: async () => wallet,
      update: async ({ data }: any) => { wallet.balance = wallet.balance.plus(data.balance.increment); return wallet },
    },
    order: {
      updateMany: async ({ where, data }: any) => {
        if (where.id !== task.order.id || where.managerId !== managerId || task.order.status !== where.status || task.order.finalReturnAmount !== null) return { count: 0 }
        Object.assign(task.order, data)
        return { count: 1 }
      },
    },
    notification: { create: async ({ data }: any) => { notifications.push(data); return data } },
    auditLog: { create: async ({ data }: any) => { auditLogs.push(data); return data } },
  }
  const prisma = {
    $transaction: async (callback: (tx: any) => Promise<any>) => {
      const next = lock.then(() => callback(tx))
      lock = next.then(() => undefined, () => undefined)
      return next
    },
  }
  return { prisma, task, wallet, transactions, notifications, auditLogs, now }
}

test('₹100 principal and manager-entered ₹150 return credit exactly ₹150 and record ₹50 revenue', async () => {
  const store = createStore()
  const result = await settleReRentTask(store.prisma as any, { taskId: 'task-1', managerId: 'manager-1', managerUserId: 'manager-user', finalReturnAmount: '150.00', now: store.now })
  assert.equal(result.finalReturnAmount, '150.00')
  assert.equal(result.revenue, '50.00')
  assert.equal(store.wallet.balance.toFixed(2), '550.00')
  assert.equal(new Decimal(String(store.task.order.finalReturnAmount)).toFixed(2), '150.00')
  assert.equal(store.task.order.profit.toFixed(2), '50.00')
  assert.equal(store.task.profitAmount.toFixed(2), '50.00')
  assert.equal(store.transactions.length, 1)
  assert.equal(store.transactions[0].amount.toFixed(2), '150.00')
  assert.equal(store.transactions[0].balanceAfter.toFixed(2), '550.00')
})

test('pending Re-Rent has no return, revenue, or wallet credit before settlement', () => {
  const store = createStore()
  assert.equal(store.task.order.finalReturnAmount, null)
  assert.equal(store.task.order.profit.toFixed(2), '0.00')
  assert.equal(store.task.profitAmount.toFixed(2), '0.00')
  assert.equal(store.transactions.length, 0)
  assert.equal(store.wallet.balance.toFixed(2), '400.00')
})

test('a manager cannot settle another manager client task', async () => {
  const store = createStore()
  await assert.rejects(
    settleReRentTask(store.prisma as any, { taskId: 'task-1', managerId: 'manager-2', managerUserId: 'manager-user-2', finalReturnAmount: '150.00', now: store.now }),
    { message: 'TASK_NOT_FOUND' },
  )
  assert.equal(store.wallet.balance.toFixed(2), '400.00')
  assert.equal(store.transactions.length, 0)
})

test('repeated and concurrent approvals create one settlement credit', async () => {
  const store = createStore()
  const args = { taskId: 'task-1', managerId: 'manager-1', managerUserId: 'manager-user', finalReturnAmount: '150.00', now: store.now }
  const results = await Promise.all(Array.from({ length: 6 }, () => settleReRentTask(store.prisma as any, args)))
  assert.equal(results.filter((result) => !result.alreadyCompleted).length, 1)
  assert.equal(store.transactions.length, 1)
  assert.equal(store.wallet.balance.toFixed(2), '550.00')
})

test('invalid or below-principal final returns are rejected; rate settings do not affect revenue', async () => {
  for (const amount of ['', '-1', '0', '100.001', '1e3', '10000000000000000.00']) {
    assert.equal(parseFinalReturnAmount(amount), null, `expected ${amount || '(empty)'} to be rejected`)
  }
  const belowPrincipalStore = createStore()
  await assert.rejects(settleReRentTask(belowPrincipalStore.prisma as any, {
    taskId: 'task-1', managerId: 'manager-1', managerUserId: 'manager-user', finalReturnAmount: '99.99', now: belowPrincipalStore.now,
  }), { message: 'INVALID_FINAL_RETURN' })
  assert.equal(parseFinalReturnAmount('100.00')?.toFixed(2), '100.00')
  const store = createStore()
  store.task.profitRate = new Decimal('1.40')
  const result = await settleReRentTask(store.prisma as any, { taskId: 'task-1', managerId: 'manager-1', managerUserId: 'manager-user', finalReturnAmount: '150.00', now: store.now })
  assert.equal(result.revenue, '50.00')
})

test('settlement delay is enforced by the manager approval service', async () => {
  const store = createStore({ delay: 60 })
  await assert.rejects(
    settleReRentTask(store.prisma as any, { taskId: 'task-1', managerId: 'manager-1', managerUserId: 'manager-user', finalReturnAmount: '150.00', now: store.now }),
    { message: 'SETTLEMENT_DELAY_ACTIVE' },
  )
  assert.equal(store.transactions.length, 0)
})

test('the scheduler rotates due records for managers without inventing or crediting a return', async () => {
  const where = getReRentCandidatesWhere(new Date('2026-10-01T00:00:00.000Z')) as any
  assert.deepEqual(where.status.in, ['SUBMITTED', 'VERIFIED'])
  let writes = 0
  const fakePrisma = {
    platformSetting: { findFirst: async () => ({ rerentDelaySeconds: 0 }) },
    task: {
      count: async () => 1,
      findMany: async () => [{ id: 'task-1' }],
    },
    $transaction: async () => { writes += 1 },
  }
  const result = await processReRentBatch(fakePrisma as any, new Date('2026-10-01T00:00:00.000Z'))
  assert.equal(result.awaitingManager, 1)
  assert.equal(result.processed, 0)
  assert.equal(writes, 0)
})
