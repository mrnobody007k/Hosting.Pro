import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Prisma, PrismaClient } from '@prisma/client'
import { expect, test, type Page, type APIRequestContext } from '@playwright/test'
import { processDailyProgressionBatch } from '../lib/daily-task-scheduler'
import { processReRentBatch } from '../lib/rerent-scheduler'
import { getDailyProgressionCandidatesWhere } from '../lib/daily-task-scheduler'
import { getReRentCandidatesWhere } from '../lib/rerent-scheduler'
import { getSchedulerWindowOffset } from '../lib/scheduler-window'
import { SCHEDULER_E2E_SECRET } from './scheduler-test-secret'

const runId = randomUUID()
const fixturePrefix = `E2E scheduler ${runId}`
const fixtureEmailPrefix = `scheduler-${runId}`
let prisma: PrismaClient
let managerId: string
let propertyId: string
let day2UserId: string
let day3UserId: string
let rerentUserId: string
let rerentOrderId: string
let rerentTaskId: string
let platformSettings: Array<{ id: string; rerentDelaySeconds: number }> = []
let createdPlatformSetting = false
let fixtureOrderIds: string[] = []

function readLocalTestDatabaseUrl() {
  const filePath = path.join(process.cwd(), '.env.local.test')
  const content = readFileSync(filePath, 'utf8')
  const value = content.match(/^\s*LOCAL_TEST_DATABASE_URL\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^(['"])(.*)\1$/, '$2')
  if (!value) throw new Error('Scheduler E2E requires LOCAL_TEST_DATABASE_URL.')
  const url = new URL(value)
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''))
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '::1'].includes(host) || database !== 'housingpro_test' || url.searchParams.has('host')) {
    throw new Error('Scheduler E2E only allows the disposable local housingpro_test database.')
  }
  return value
}

function scopedDailyClient(userId: string) {
  return {
    user: {
      count: (args: { where?: Prisma.UserWhereInput }) => prisma.user.count({ where: { AND: [args.where ?? {}, { id: userId }] } }),
      findMany: (args: Prisma.UserFindManyArgs) => prisma.user.findMany({ ...args, where: { AND: [args.where ?? {}, { id: userId }] } }),
    },
    $transaction: prisma.$transaction.bind(prisma),
  } as unknown as PrismaClient
}

function scopedReRentClient(taskId: string) {
  return {
    platformSetting: { findFirst: prisma.platformSetting.findFirst.bind(prisma.platformSetting) },
    task: {
      count: (args: { where?: Prisma.TaskWhereInput }) => prisma.task.count({ where: { AND: [args.where ?? {}, { id: taskId }] } }),
      findMany: (args: Prisma.TaskFindManyArgs) => prisma.task.findMany({ ...args, where: { AND: [args.where ?? {}, { id: taskId }] } }),
    },
    $transaction: prisma.$transaction.bind(prisma),
  } as unknown as PrismaClient
}

async function signInManager(page: Page) {
  await page.goto(`/manager-login/${process.env.E2E_MANAGER_ACCESS_TOKEN}`)
  await page.getByLabel('Email address').fill('test-manager-one@housing.pro')
  await page.getByLabel('Password').fill(process.env.E2E_MANAGER_PASSWORD!)
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page).toHaveURL(/\/manager\/?$/)
}

async function postScheduler(request: APIRequestContext, authorization?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authorization) headers.authorization = authorization
  return request.post('/api/internal/scheduler/process', { headers, data: {} })
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  prisma = new PrismaClient({ datasourceUrl: readLocalTestDatabaseUrl() })
  const manager = await prisma.manager.findUnique({ where: { email: 'test-manager-one@housing.pro' }, select: { id: true, status: true } })
  if (!manager || manager.status !== 'ACTIVE') throw new Error('Scheduler E2E requires the active local manager fixture.')
  managerId = manager.id

  platformSettings = await prisma.platformSetting.findMany({ select: { id: true, rerentDelaySeconds: true } })
  if (platformSettings.length) {
    await prisma.platformSetting.updateMany({ data: { rerentDelaySeconds: 2 } })
  } else {
    const setting = await prisma.platformSetting.create({ data: { rerentDelaySeconds: 2 } })
    platformSettings = [{ id: setting.id, rerentDelaySeconds: 2 }]
    createdPlatformSetting = true
  }

  const oldApproval = new Date(Date.now() - 10 * 86_400_000)
  const [day2User, day3User, rerentUser] = await Promise.all([
    prisma.user.create({ data: { name: `${fixturePrefix} Day 2`, email: `${fixtureEmailPrefix}-day2@housing.pro`, passwordHash: 'local-test-only', status: 'ACTIVE', signupStatus: 'APPROVED', membershipStatus: 'DAY_1', approvedAt: oldApproval, managerId }, select: { id: true } }),
    prisma.user.create({ data: { name: `${fixturePrefix} Day 3`, email: `${fixtureEmailPrefix}-day3@housing.pro`, passwordHash: 'local-test-only', status: 'ACTIVE', signupStatus: 'APPROVED', membershipStatus: 'OFFICIAL_MEMBER', approvedAt: oldApproval, managerId }, select: { id: true } }),
    prisma.user.create({ data: { name: `${fixturePrefix} Re-Rent`, email: `${fixtureEmailPrefix}-rerent@housing.pro`, passwordHash: 'local-test-only', status: 'ACTIVE', signupStatus: 'APPROVED', membershipStatus: 'OFFICIAL_MEMBER', approvedAt: oldApproval, managerId }, select: { id: true } }),
  ])
  day2UserId = day2User.id
  day3UserId = day3User.id
  rerentUserId = rerentUser.id

  const property = await prisma.property.create({ data: { managerId, title: fixturePrefix, price: '1000.00', status: 'ACTIVE' }, select: { id: true } })
  propertyId = property.id
  const [day2Order, day3Order, rerentOrder] = await Promise.all([
    prisma.order.create({ data: { orderCode: `${fixturePrefix}-day2`, userId: day2UserId, managerId, propertyId, amount: '1000.00', status: 'ACTIVE', paymentStatus: 'PAID', paymentVerifiedAt: new Date(), activatedAt: new Date() }, select: { id: true } }),
    prisma.order.create({ data: { orderCode: `${fixturePrefix}-day3`, userId: day3UserId, managerId, propertyId, amount: '1000.00', status: 'ACTIVE', paymentStatus: 'PAID', paymentVerifiedAt: new Date(), activatedAt: new Date() }, select: { id: true } }),
    prisma.order.create({ data: { orderCode: `${fixturePrefix}-rerent`, userId: rerentUserId, managerId, propertyId, amount: '1000.00', status: 'RE_RENT_PENDING', paymentStatus: 'PAID', paymentVerifiedAt: new Date(), rerentRequestedAt: new Date() }, select: { id: true } }),
  ])
  rerentOrderId = rerentOrder.id
  fixtureOrderIds = [day2Order.id, day3Order.id, rerentOrder.id]

  for (const [type, orderId] of [['DAY_2_MORNING', day3Order.id], ['DAY_2_AFTERNOON', day3Order.id]] as const) {
    const task = await prisma.task.create({ data: { userId: day3UserId, managerId, orderId, type, title: `${fixturePrefix} ${type}`, dayNumber: 2, profitRate: '1.20', profitAmount: '12.00', status: 'COMPLETED' }, select: { id: true } })
    await prisma.transaction.create({ data: { userId: day3UserId, managerId, type: 'PROFIT', amount: '12.00', balanceBefore: '0.00', balanceAfter: '12.00', reference: task.id } })
  }

  await prisma.wallet.create({ data: { userId: rerentUserId, balance: '0.00' } })
  const rerentTask = await prisma.task.create({ data: { userId: rerentUserId, managerId, orderId: rerentOrderId, type: 'RE_RENT', title: `${fixturePrefix} Re-Rent task`, dayNumber: 0, profitRate: '1.20', status: 'VERIFIED', submittedAt: new Date() }, select: { id: true } })
  rerentTaskId = rerentTask.id

  // Ensure the Day 2 test order is linked for both generated task records.
  assert.ok(day2Order.id)
})

test.afterAll(async () => {
  if (!prisma) return
  try {
    const taskIds: string[] = []
    if (day3UserId) {
      const day3Tasks = await prisma.task.findMany({ where: { userId: day3UserId }, select: { id: true } })
      taskIds.push(...day3Tasks.map(({ id }) => id))
    }
    if (day2UserId) {
      const day2Tasks = await prisma.task.findMany({ where: { userId: day2UserId }, select: { id: true } })
      taskIds.push(...day2Tasks.map(({ id }) => id))
    }
    if (rerentTaskId) taskIds.push(rerentTaskId)
    const orderIds = fixtureOrderIds
    if (taskIds.length) {
      const userIds = [day2UserId, day3UserId, rerentUserId].filter(Boolean)
      await prisma.auditLog.deleteMany({ where: { targetId: { in: [...taskIds, ...orderIds, ...userIds] } } })
      await prisma.transaction.deleteMany({ where: { reference: { in: taskIds } } })
      await prisma.task.deleteMany({ where: { id: { in: taskIds } } })
    }
    if (orderIds.length) await prisma.order.deleteMany({ where: { id: { in: orderIds } } })
    if (propertyId) await prisma.property.deleteMany({ where: { id: propertyId } })
    if (rerentUserId) await prisma.wallet.deleteMany({ where: { userId: rerentUserId } })
    const userIds = [day2UserId, day3UserId, rerentUserId].filter(Boolean)
    if (userIds.length) {
      await prisma.notification.deleteMany({ where: { userId: { in: userIds } } })
      await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    }
    if (platformSettings.length && !createdPlatformSetting) {
      // Restore only the local disposable test database's pre-test settings.
      for (const setting of platformSettings) {
        if (setting.rerentDelaySeconds !== 2) await prisma.platformSetting.update({ where: { id: setting.id }, data: { rerentDelaySeconds: setting.rerentDelaySeconds } })
      }
    } else if (createdPlatformSetting && platformSettings.length === 1) {
      await prisma.platformSetting.deleteMany({ where: { id: platformSettings[0].id } })
    }
  } finally {
    await prisma.$disconnect()
  }
})

test('authenticated scheduler progresses daily tasks and leaves due Re-Rent returns for manager settlement', async ({ request, page }) => {
  test.setTimeout(120_000)

  const dailyClient = scopedDailyClient(day2UserId)
  const now = new Date()
  const day2Candidates = getDailyProgressionCandidatesWhere(now)
  const day2CandidateCount = await prisma.user.count({ where: { AND: [day2Candidates, { id: day2UserId }] } })
  expect(day2CandidateCount).toBe(1)
  const day2First = await processDailyProgressionBatch(dailyClient, now)
  expect(day2First.processed).toBe(1)
  const day2Tasks = await prisma.task.findMany({ where: { userId: day2UserId, type: { in: ['DAY_2_MORNING', 'DAY_2_AFTERNOON'] } }, orderBy: { type: 'asc' } })
  expect(day2Tasks).toHaveLength(2)
  expect(day2Tasks.map((task) => task.type).sort()).toEqual(['DAY_2_AFTERNOON', 'DAY_2_MORNING'])
  expect(day2Tasks.every((task) => task.status === 'PENDING' && task.profitRate.toString() === '1.2')).toBe(true)
  expect(await prisma.transaction.count({ where: { userId: day2UserId, type: 'PROFIT' } })).toBe(0)
  expect((await prisma.user.findUniqueOrThrow({ where: { id: day2UserId }, select: { membershipStatus: true } })).membershipStatus).toBe('DAY_2')

  const repeatedDay2 = await processDailyProgressionBatch(dailyClient, new Date())
  expect(repeatedDay2.considered).toBe(0)
  expect(await prisma.task.count({ where: { userId: day2UserId, type: { in: ['DAY_2_MORNING', 'DAY_2_AFTERNOON'] } } })).toBe(2)

  const day3Client = scopedDailyClient(day3UserId)
  const day3First = await processDailyProgressionBatch(day3Client, new Date())
  expect(day3First.processed).toBe(1)
  const day3Tasks = await prisma.task.findMany({ where: { userId: day3UserId, type: 'DAY_3_OFFICIAL' } })
  expect(day3Tasks).toHaveLength(1)
  expect(day3Tasks[0].status).toBe('PENDING')
  expect(day3Tasks[0].profitRate.toString()).toBe('1.4')
  const repeatedDay3 = await processDailyProgressionBatch(day3Client, new Date())
  expect(repeatedDay3.considered).toBe(0)
  expect(await prisma.task.count({ where: { userId: day3UserId, type: 'DAY_3_OFFICIAL' } })).toBe(1)

  const delaySetting = await prisma.platformSetting.findFirst({ select: { rerentDelaySeconds: true } })
  const delaySeconds = delaySetting?.rerentDelaySeconds ?? 90
  const earlySubmitAt = new Date(Date.now() - 250)
  await prisma.task.update({ where: { id: rerentTaskId }, data: { submittedAt: earlySubmitAt } })
  const rerentClient = scopedReRentClient(rerentTaskId)
  const earlyRun = await processReRentBatch(rerentClient, new Date())
  if (delaySeconds > 0) {
    expect(earlyRun.considered).toBe(0)
    expect((await prisma.task.findUniqueOrThrow({ where: { id: rerentTaskId }, select: { status: true } })).status).toBe('VERIFIED')
    expect((await prisma.order.findUniqueOrThrow({ where: { id: rerentOrderId }, select: { status: true } })).status).toBe('RE_RENT_PENDING')
  }

  await prisma.task.update({ where: { id: rerentTaskId }, data: { submittedAt: new Date(Date.now() - (delaySeconds + 3) * 1000) } })
  const concurrentRuns = await Promise.all([
    processReRentBatch(rerentClient, new Date()),
    processReRentBatch(rerentClient, new Date()),
  ])
  expect(concurrentRuns.every((result) => result.failed === 0)).toBe(true)
  expect((await prisma.task.findUniqueOrThrow({ where: { id: rerentTaskId }, select: { status: true, profitAmount: true } })).status).toBe('VERIFIED')
  expect((await prisma.task.findUniqueOrThrow({ where: { id: rerentTaskId }, select: { profitAmount: true } })).profitAmount.toString()).toBe('0')
  expect((await prisma.order.findUniqueOrThrow({ where: { id: rerentOrderId }, select: { status: true, profit: true, finalReturnAmount: true } })).status).toBe('RE_RENT_PENDING')
  expect((await prisma.order.findUniqueOrThrow({ where: { id: rerentOrderId }, select: { profit: true, finalReturnAmount: true } })).finalReturnAmount).toBeNull()
  expect((await prisma.wallet.findUniqueOrThrow({ where: { userId: rerentUserId }, select: { balance: true } })).balance.toString()).toBe('0')
  expect(await prisma.transaction.count({ where: { userId: rerentUserId, managerId, type: 'RERENT_SETTLEMENT', reference: rerentTaskId } })).toBe(0)

  const missingAuth = await postScheduler(request)
  expect(missingAuth.status()).toBe(401)
  const invalidAuth = await postScheduler(request, 'Bearer invalid-scheduler-token')
  expect(invalidAuth.status()).toBe(401)
  const wrongMethod = await request.get('/api/internal/scheduler/process')
  expect(wrongMethod.status()).toBe(405)
  const validAuth = await postScheduler(request, `Bearer ${SCHEDULER_E2E_SECRET}`)
  const responseBody = await validAuth.json()
  expect([200, 503]).toContain(validAuth.status())
  expect(responseBody).toHaveProperty('daily')
  expect(responseBody).toHaveProperty('rerent')
  expect(validAuth.headers()['cache-control']).toBe('no-store')
  expect(JSON.stringify(responseBody)).not.toContain(day2UserId)
  expect(JSON.stringify(responseBody)).not.toContain(day3UserId)
  expect(JSON.stringify(responseBody)).not.toContain(rerentUserId)

  await signInManager(page)
  const manualManagerSync = await page.context().request.post(new URL('/api/manager/clients/sync', page.url()).toString(), {
    data: { userId: day2UserId },
    headers: { Origin: new URL(page.url()).origin },
  })
  expect(manualManagerSync.status()).toBe(200)
  expect((await manualManagerSync.json()).ok).toBe(true)

  // A due task remains a candidate until a manager settles it. The scheduler
  // only discovers candidates and does not mutate or credit the Re-Rent task.
  const rerentWhere = getReRentCandidatesWhere(new Date(Date.now() - (delaySeconds + 4) * 1000))
  const matchingCandidates = await prisma.task.count({ where: { AND: [rerentWhere, { id: rerentTaskId }] } })
  expect(matchingCandidates).toBe(1)
  const currentCandidates = await prisma.user.count({ where: { AND: [getDailyProgressionCandidatesWhere(new Date()), { id: day2UserId }] } })
  expect(currentCandidates).toBe(0)
  expect(getSchedulerWindowOffset(new Date(), 1, 40)).toBe(0)
})
