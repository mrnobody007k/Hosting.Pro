import assert from 'node:assert/strict'
import Decimal from 'decimal.js'
import test from 'node:test'
import { creditVerifiedDailyTask } from '../lib/daily-task-settlement'

function createFixture({ managerId = 'manager-1', paymentStatus = 'PAID', existingCredit = false } = {}) {
  const task: any = {
    id: 'task-1', userId: 'user-1', managerId: 'manager-1', title: 'Morning task',
    type: 'DAY_2_MORNING', status: 'VERIFIED', assignedAt: new Date('2026-10-01T00:00:00Z'),
    user: {
      id: 'user-1', managerId: 'manager-1', status: 'ACTIVE', signupStatus: 'APPROVED',
      membershipStatus: 'DAY_2', manager: { status: 'ACTIVE' },
    },
    order: {
      id: 'order-1', userId: 'user-1', managerId: 'manager-1', orderCode: 'HP-1',
      amount: new Decimal('100.00'), status: 'ACTIVE', paymentStatus,
      paymentVerifiedAt: new Date('2026-10-01T00:00:00Z'),
    },
  }
  const wallet = { userId: 'user-1', balance: new Decimal('250.00') }
  const credits: any[] = []
  const notifications: any[] = []
  const audits: any[] = []
  const tx: any = {
    task: {
      findFirst: async ({ where }: any) => where.managerId === managerId && task.managerId === where.managerId && task.status === where.status ? task : null,
      findMany: async ({ select }: any) => select.status
        ? [
            { id: 'task-1', type: 'DAY_2_MORNING', status: task.status },
            { id: 'task-2', type: 'DAY_2_AFTERNOON', status: 'PENDING' },
          ]
        : [{ id: 'task-1' }],
      updateMany: async ({ where, data }: any) => {
        if (where.id !== task.id || where.managerId !== managerId || task.status !== where.status) return { count: 0 }
        Object.assign(task, data)
        return { count: 1 }
      },
    },
    transaction: {
      findFirst: async () => existingCredit ? { id: 'existing-credit' } : null,
      findMany: async () => credits.map(({ reference }) => ({ reference })),
      create: async ({ data }: any) => { credits.push(data); return data },
    },
    wallet: {
      findUnique: async () => wallet,
      update: async ({ data }: any) => { wallet.balance = wallet.balance.plus(data.balance.increment); return wallet },
    },
    notification: { create: async ({ data }: any) => { notifications.push(data); return data } },
    auditLog: { create: async ({ data }: any) => { audits.push(data); return data } },
    user: { updateMany: async () => ({ count: 0 }) },
  }
  return { tx, task, wallet, credits, notifications, audits, managerId }
}

test('verified Day 2 task credits the established rate once with matching wallet, ledger, audit, and notification', async () => {
  const store = createFixture()
  const result = await creditVerifiedDailyTask(store.tx, { taskId: 'task-1', managerId: 'manager-1', managerUserId: 'manager-user-1' })

  assert.equal(result.profit, '1.20')
  assert.equal(store.task.status, 'COMPLETED')
  assert.equal(store.wallet.balance.toFixed(2), '251.20')
  assert.equal(store.credits.length, 1)
  assert.equal(store.credits[0].amount.toFixed(2), '1.20')
  assert.equal(store.credits[0].reference, 'task-1')
  assert.equal(store.credits[0].balanceBefore.toFixed(2), '250.00')
  assert.equal(store.credits[0].balanceAfter.toFixed(2), '251.20')
  assert.equal(store.audits[0].actorId, 'manager-user-1')
  assert.equal(store.audits[0].action, 'DAILY_TASK_PROFIT_CREDITED')
  assert.equal(store.notifications.length, 1)
})

test('a repeat credit attempt does not increment the wallet or add another ledger row', async () => {
  const store = createFixture()
  await creditVerifiedDailyTask(store.tx, { taskId: 'task-1', managerId: 'manager-1', managerUserId: 'manager-user-1' })

  await assert.rejects(
    creditVerifiedDailyTask(store.tx, { taskId: 'task-1', managerId: 'manager-1', managerUserId: 'manager-user-1' }),
    /TASK_NOT_VERIFIED/,
  )
  assert.equal(store.wallet.balance.toFixed(2), '251.20')
  assert.equal(store.credits.length, 1)
})

test('existing task ledger reference prevents a second wallet credit', async () => {
  const store = createFixture({ existingCredit: true })
  await assert.rejects(
    creditVerifiedDailyTask(store.tx, { taskId: 'task-1', managerId: 'manager-1', managerUserId: 'manager-user-1' }),
    /TASK_ALREADY_CREDITED/,
  )
  assert.equal(store.wallet.balance.toFixed(2), '250.00')
  assert.equal(store.credits.length, 0)
})

test('task ownership and verified payment status are required before wallet mutation', async () => {
  const foreignManager = createFixture({ managerId: 'manager-2' })
  await assert.rejects(
    creditVerifiedDailyTask(foreignManager.tx, { taskId: 'task-1', managerId: 'manager-2', managerUserId: 'manager-user-2' }),
    /TASK_NOT_VERIFIED/,
  )
  assert.equal(foreignManager.wallet.balance.toFixed(2), '250.00')

  const unpaidOrder = createFixture({ paymentStatus: 'PENDING' })
  await assert.rejects(
    creditVerifiedDailyTask(unpaidOrder.tx, { taskId: 'task-1', managerId: 'manager-1', managerUserId: 'manager-user-1' }),
    /VERIFIED_ORDER_REQUIRED/,
  )
  assert.equal(unpaidOrder.wallet.balance.toFixed(2), '250.00')
})
