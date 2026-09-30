import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { expect, test, type Page } from '@playwright/test'

const fixturePrefix = `E2E verification fixture ${randomUUID()}`
const alternateFixtureSuffix = randomUUID()
const alternateManagerEmail = `test-manager-two-${alternateFixtureSuffix}@housing.pro`
const alternateSameManagerUserEmail = `test-customer-two-${alternateFixtureSuffix}@housing.pro`
const alternateOtherManagerUserEmail = `test-customer-three-${alternateFixtureSuffix}@housing.pro`
const delayForTestSeconds = 5
let prisma: PrismaClient
let managerId: string
let userId: string
let otherManagerId: string
let otherUserSameManagerId: string
let otherUserOtherManagerId: string
let otherTestPassword: string
let propertyId: string
let orderIds: string[] = []
let dailyTaskIds: Record<string, string> = {}
let originalUser: { status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED'; signupStatus: 'PENDING' | 'APPROVED' | 'REJECTED'; membershipStatus: 'DAY_1' | 'DAY_2' | 'OFFICIAL_MEMBER' | 'PENDING_APPROVAL'; officialMemberAt: Date | null } | null = null
let originalWalletBalance: string | null = null
let createdWallet = false
let settingId: string | null = null
let createdSetting = false
let settingSnapshots: Array<{ id: string; rerentDelaySeconds: number }> = []
let notificationIdsBefore: string[] = []
let testStartedAt: Date

function getLocalTestDatabaseUrl() {
  const filePath = path.join(process.cwd(), '.env.local.test')
  let content: string
  try {
    content = readFileSync(filePath, 'utf8')
  } catch {
    throw new Error('Task verification tests require .env.local.test with a disposable local database.')
  }
  const value = content.match(/^\s*LOCAL_TEST_DATABASE_URL\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^(['"])(.*)\1$/, '$2')
  if (!value) throw new Error('Task verification tests require LOCAL_TEST_DATABASE_URL.')
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('Task verification tests refuse an invalid local database URL.')
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''))
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '::1'].includes(host) || database !== 'housingpro_test' || url.searchParams.has('host')) {
    throw new Error('Task verification tests only allow the disposable local housingpro_test database.')
  }
  return value
}

async function signIn(page: Page, role: 'manager' | 'user', account: 'one' | 'other-same-manager' | 'other-manager' = 'one') {
  const user = role === 'user'
  const loginPath = user ? '/login' : '/manager-login'
  const token = user ? process.env.E2E_USER_ACCESS_TOKEN! : process.env.E2E_MANAGER_ACCESS_TOKEN!
  const email = !user ? (account === 'other-manager' ? alternateManagerEmail : 'test-manager-one@housing.pro') : account === 'other-same-manager' ? alternateSameManagerUserEmail : account === 'other-manager' ? alternateOtherManagerUserEmail : 'test-customer-one@housing.pro'
  const password = account === 'one' ? (user ? process.env.E2E_USER_PASSWORD! : process.env.E2E_MANAGER_PASSWORD!) : otherTestPassword
  await page.goto(`${loginPath}/${token}`)
  await page.getByLabel(user ? 'Email address or phone number' : 'Email address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Continue' }).click()
  try {
    await expect(page).toHaveURL(user ? /\/user\/?$/ : /\/manager\/?$/, { timeout: 15000 })
  } catch {
    throw new Error(`E2E ${role} sign-in (${account}) did not reach its panel.`)
  }
}

async function post(page: Page, url: string, data: Record<string, unknown>) {
  const response = await page.context().request.post(new URL(url, page.url()).toString(), {
    timeout: 15000,
    data,
    headers: { Origin: new URL(page.url()).origin },
  })
  return { status: response.status(), body: await response.json() }
}

async function createOrder(suffix: string, status: 'ACTIVE' | 'RE_RENT_PENDING' = 'ACTIVE') {
  const now = new Date()
  const order = await prisma.order.create({
    data: {
      orderCode: `${fixturePrefix.replaceAll(' ', '-')}-${suffix}`,
      userId,
      managerId,
      propertyId,
      amount: '1000.00',
      status,
      paymentStatus: 'PAID',
      paymentVerifiedAt: now,
      activatedAt: status === 'ACTIVE' ? now : null,
      rerentRequestedAt: status === 'RE_RENT_PENDING' ? new Date(now.getTime() - 20_000) : null,
    },
  })
  orderIds.push(order.id)
  return order
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  prisma = new PrismaClient({ datasourceUrl: getLocalTestDatabaseUrl() })
  testStartedAt = new Date()
  const [manager, user] = await Promise.all([
    prisma.manager.findUnique({ where: { email: 'test-manager-one@housing.pro' }, select: { id: true, status: true } }),
    prisma.user.findUnique({ where: { email: 'test-customer-one@housing.pro' }, select: { id: true, managerId: true, status: true, signupStatus: true, membershipStatus: true, officialMemberAt: true } }),
  ])
  if (!manager || manager.status !== 'ACTIVE' || !user || user.status !== 'ACTIVE' || user.managerId !== manager.id) {
    throw new Error('Task verification tests require the active local E2E manager and customer fixtures.')
  }
  managerId = manager.id
  userId = user.id
  otherTestPassword = `Local-only-${randomUUID()}!`
  const otherPasswordHash = await bcrypt.hash(otherTestPassword, 12)
  const otherManager = await prisma.manager.create({
    data: { name: 'Housing.pro Test Manager Two', email: alternateManagerEmail, passwordHash: otherPasswordHash, referralCode: `e2e-${randomUUID()}` },
    select: { id: true },
  })
  otherManagerId = otherManager.id
  const [otherSameManager, otherManagerUser] = await Promise.all([
    prisma.user.create({ data: { name: 'Housing.pro Test Customer Two', email: alternateSameManagerUserEmail, passwordHash: otherPasswordHash, managerId, status: 'ACTIVE', signupStatus: 'APPROVED', membershipStatus: 'DAY_2', approvedAt: new Date() }, select: { id: true } }),
    prisma.user.create({ data: { name: 'Housing.pro Test Customer Three', email: alternateOtherManagerUserEmail, passwordHash: otherPasswordHash, managerId: otherManagerId, status: 'ACTIVE', signupStatus: 'APPROVED', membershipStatus: 'DAY_2', approvedAt: new Date() }, select: { id: true } }),
  ])
  otherUserSameManagerId = otherSameManager.id
  otherUserOtherManagerId = otherManagerUser.id
  originalUser = { status: user.status, signupStatus: user.signupStatus, membershipStatus: user.membershipStatus, officialMemberAt: user.officialMemberAt }

  const oldOrders = await prisma.order.findMany({ where: { orderCode: { startsWith: 'E2E-verification-fixture-' } }, select: { id: true } })
  const oldOrderIds = oldOrders.map((order) => order.id)
  const oldTasks = await prisma.task.findMany({ where: { userId, OR: [{ orderId: { in: oldOrderIds } }, { title: { startsWith: 'E2E verification fixture ' } }] }, select: { id: true } })
  const oldTaskIds = oldTasks.map((task) => task.id)
  if (oldTaskIds.length) {
    await prisma.transaction.deleteMany({ where: { userId, reference: { in: oldTaskIds } } })
    await prisma.auditLog.deleteMany({ where: { targetType: { in: ['TASK', 'ORDER'] }, targetId: { in: [...oldTaskIds, ...oldOrderIds] } } })
    await prisma.task.deleteMany({ where: { id: { in: oldTaskIds } } })
  }
  if (oldOrderIds.length) await prisma.order.deleteMany({ where: { id: { in: oldOrderIds } } })
  await prisma.property.deleteMany({ where: { managerId, title: { startsWith: 'E2E verification fixture ' } } })

  const [wallet, settings, notifications] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId }, select: { balance: true } }),
    prisma.platformSetting.findMany({ select: { id: true, rerentDelaySeconds: true } }),
    prisma.notification.findMany({ where: { userId }, select: { id: true } }),
  ])
  originalWalletBalance = wallet?.balance.toString() ?? null
  notificationIdsBefore = notifications.map((notification) => notification.id)
  if (!wallet) {
    createdWallet = true
    await prisma.wallet.create({ data: { userId, balance: '0.00' } })
  }
  if (settings.length) {
    settingSnapshots = settings
    await prisma.platformSetting.updateMany({ data: { rerentDelaySeconds: delayForTestSeconds } })
  } else {
    createdSetting = true
    const settingCreated = await prisma.platformSetting.create({ data: { rerentDelaySeconds: delayForTestSeconds } })
    settingId = settingCreated.id
  }

  await prisma.user.update({ where: { id: userId }, data: { signupStatus: 'APPROVED', membershipStatus: 'DAY_2', officialMemberAt: null } })
  const property = await prisma.property.create({
    data: { managerId, title: fixturePrefix, price: '1000.00', status: 'ACTIVE' },
  })
  propertyId = property.id
  const dailyOrder = await createOrder('daily')
  const earliest = new Date(0)
  for (const [type, dayNumber] of [['DAY_2_MORNING', 2], ['DAY_2_AFTERNOON', 2], ['DAY_3_OFFICIAL', 3]] as const) {
    const task = await prisma.task.create({
      data: {
        userId,
        managerId,
        orderId: dailyOrder.id,
        type,
        title: `${fixturePrefix} ${type}`,
        description: 'Automated test activity.',
        dayNumber,
        profitRate: type === 'DAY_3_OFFICIAL' ? '1.40' : '1.20',
        assignedAt: earliest,
      },
    })
    dailyTaskIds[type] = task.id
  }
})

test.afterAll(async () => {
  if (!prisma) return
  if (!userId) {
    await prisma.$disconnect()
    return
  }
  try {
    const restorations: Promise<unknown>[] = []
    if (otherUserSameManagerId) restorations.push(prisma.user.deleteMany({ where: { id: otherUserSameManagerId } }))
    if (otherUserOtherManagerId) restorations.push(prisma.user.deleteMany({ where: { id: otherUserOtherManagerId } }))
    if (userId && originalUser) restorations.push(prisma.user.update({ where: { id: userId }, data: originalUser }))
    if (userId && originalWalletBalance !== null) restorations.push(prisma.wallet.update({ where: { userId }, data: { balance: originalWalletBalance } }))
    else if (userId && createdWallet) restorations.push(prisma.wallet.deleteMany({ where: { userId } }))
    if (settingSnapshots.length) {
      for (const setting of settingSnapshots) restorations.push(prisma.platformSetting.update({ where: { id: setting.id }, data: { rerentDelaySeconds: setting.rerentDelaySeconds } }))
    } else if (settingId && createdSetting) {
      restorations.push(prisma.platformSetting.deleteMany({ where: { id: settingId } }))
    }
    await Promise.all(restorations)
    if (otherManagerId) await prisma.manager.deleteMany({ where: { id: otherManagerId } })

    const fixtureTasks = await prisma.task.findMany({ where: { userId, managerId, orderId: { in: orderIds } }, select: { id: true } })
    const taskIds = [...new Set([...Object.values(dailyTaskIds), ...fixtureTasks.map((task) => task.id)])]
    await prisma.transaction.deleteMany({ where: { userId, reference: { in: taskIds } } })
    await prisma.auditLog.deleteMany({ where: { targetId: { in: [...taskIds, ...orderIds] } } })
    await prisma.task.deleteMany({ where: { id: { in: taskIds } } })
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } })
    if (propertyId) await prisma.property.deleteMany({ where: { id: propertyId } })
    if (notificationIdsBefore.length) await prisma.notification.deleteMany({ where: { userId, id: { notIn: notificationIdsBefore }, createdAt: { gte: testStartedAt } } })
  } finally {
    await prisma.$disconnect()
  }
})

test('daily and Re-Rent profits require manager verification and settle at most once', async ({ page, browser }) => {
  test.setTimeout(120000)
  const managerPage = await browser.newPage()
  await signIn(page, 'user')
  await signIn(managerPage, 'manager')

  const walletBalance = async () => (await prisma.wallet.findUniqueOrThrow({ where: { userId }, select: { balance: true } })).balance.toString()
  const transactionCount = async (taskId: string) => prisma.transaction.count({ where: { userId, managerId, type: 'PROFIT', reference: taskId } })

  const morningId = dailyTaskIds.DAY_2_MORNING
  const beforeMorning = await walletBalance()
  const morningSubmission = await post(page, '/api/user/tasks/daily', { taskId: morningId })
  expect(morningSubmission.status).toBe(200)
  expect(morningSubmission.body.status).toBe('SUBMITTED')
  expect(await prisma.task.findUniqueOrThrow({ where: { id: morningId }, select: { status: true } })).toEqual({ status: 'SUBMITTED' })
  expect(await walletBalance()).toBe(beforeMorning)
  expect(await transactionCount(morningId)).toBe(0)
  expect((await post(page, '/api/user/tasks/daily', { taskId: morningId })).status).toBe(409)
  expect((await post(page, '/api/user/tasks/settle', { taskId: morningId })).status).toBe(404)

  const morningRejection = await post(managerPage, `/api/manager/tasks/${morningId}/review`, { decision: 'REJECT' })
  expect(morningRejection.status).toBe(200)
  expect(morningRejection.body.status).toBe('REJECTED')
  expect(await walletBalance()).toBe(beforeMorning)
  expect(await transactionCount(morningId)).toBe(0)

  const sameManagerOtherUserPage = await browser.newPage()
  await signIn(sameManagerOtherUserPage, 'user', 'other-same-manager')
  const sameManagerDailyAttempt = await post(sameManagerOtherUserPage, '/api/user/tasks/daily', { taskId: morningId })
  expect(sameManagerDailyAttempt.status).toBe(404)
  expect((await prisma.task.findUniqueOrThrow({ where: { id: morningId }, select: { status: true } })).status).toBe('REJECTED')
  const otherManagerUserPage = await browser.newPage()
  await signIn(otherManagerUserPage, 'user', 'other-manager')
  const otherManagerDailyAttempt = await post(otherManagerUserPage, '/api/user/tasks/daily', { taskId: morningId })
  expect(otherManagerDailyAttempt.status).toBe(404)
  expect((await prisma.task.findUniqueOrThrow({ where: { id: morningId }, select: { status: true } })).status).toBe('REJECTED')
  await sameManagerOtherUserPage.close()
  await otherManagerUserPage.close()

  const morningRetry = await post(page, '/api/user/tasks/daily', { taskId: morningId })
  expect(morningRetry.status).toBe(200)
  expect(morningRetry.body.status).toBe('SUBMITTED')
  expect(morningRetry.body.retryingRejected).toBe(true)
  expect((await prisma.task.findUniqueOrThrow({ where: { id: morningId }, select: { status: true } })).status).toBe('SUBMITTED')
  expect(await walletBalance()).toBe(beforeMorning)
  expect(await transactionCount(morningId)).toBe(0)

  const morningApproval = await post(managerPage, `/api/manager/tasks/${morningId}/review`, { decision: 'APPROVE' })
  expect(morningApproval.status).toBe(200)
  expect(morningApproval.body.status).toBe('COMPLETED')
  await expect.poll(() => prisma.task.findUniqueOrThrow({ where: { id: morningId }, select: { status: true } })).toEqual({ status: 'COMPLETED' })
  expect(await transactionCount(morningId)).toBe(1)
  expect(Number(await walletBalance()) - Number(beforeMorning)).toBe(12)
  const repeatedMorningApproval = await post(managerPage, `/api/manager/tasks/${morningId}/review`, { decision: 'APPROVE' })
  expect(repeatedMorningApproval.status).toBe(200)
  expect(repeatedMorningApproval.body.alreadyProcessed).toBe(true)
  expect(await transactionCount(morningId)).toBe(1)

  const afternoonId = dailyTaskIds.DAY_2_AFTERNOON
  const beforeAfternoon = await walletBalance()
  expect((await post(page, '/api/user/tasks/daily', { taskId: afternoonId })).body.status).toBe('SUBMITTED')
  expect(await walletBalance()).toBe(beforeAfternoon)
  const afternoonApproval = await post(managerPage, `/api/manager/tasks/${afternoonId}/review`, { decision: 'APPROVE' })
  expect(afternoonApproval.status).toBe(200)
  expect(Number(await walletBalance()) - Number(beforeAfternoon)).toBe(12)
  expect((await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { membershipStatus: true } })).membershipStatus).toBe('OFFICIAL_MEMBER')

  const day3Id = dailyTaskIds.DAY_3_OFFICIAL
  const beforeDay3 = await walletBalance()
  expect((await post(page, '/api/user/tasks/daily', { taskId: day3Id })).body.status).toBe('SUBMITTED')
  const day3Approval = await post(managerPage, `/api/manager/tasks/${day3Id}/review`, { decision: 'APPROVE' })
  expect(day3Approval.status).toBe(200)
  expect(Number(await walletBalance()) - Number(beforeDay3)).toBe(14)
  expect(await transactionCount(day3Id)).toBe(1)

  const rerentOrder = await createOrder('rerent')
  const assignment = await post(managerPage, '/api/manager/orders/rerent', { orderId: rerentOrder.id })
  expect(assignment.status).toBe(200)
  const assignedTaskId = assignment.body.task.id as string
  const beforeRerent = await walletBalance()
  expect((await post(page, '/api/user/tasks', { taskId: assignedTaskId })).body.task.status).toBe('SUBMITTED')
  expect(await walletBalance()).toBe(beforeRerent)
  expect(await transactionCount(assignedTaskId)).toBe(0)
  expect((await post(page, '/api/user/tasks/settle', { taskId: assignedTaskId })).status).toBe(409)
  const rerentApproval = await post(managerPage, `/api/manager/tasks/${assignedTaskId}/review`, { decision: 'APPROVE' })
  expect(rerentApproval.body.status).toBe('VERIFIED')
  const beforeDelay = await post(page, '/api/user/tasks/settle', { taskId: assignedTaskId })
  expect(beforeDelay.status).toBe(200)
  expect(beforeDelay.body.processing).toBe(true)
  const submittedAt = (await prisma.task.findUniqueOrThrow({ where: { id: assignedTaskId }, select: { submittedAt: true } })).submittedAt!
  const remaining = Math.max(0, delayForTestSeconds * 1000 - (Date.now() - submittedAt.getTime()) + 100)
  if (remaining) await new Promise((resolve) => setTimeout(resolve, remaining))
  const concurrentSettlements = await Promise.all(Array.from({ length: 3 }, () => post(page, '/api/user/tasks/settle', { taskId: assignedTaskId })))
  expect(concurrentSettlements.every((result) => result.status === 200 && result.body.completed === true)).toBe(true)
  expect(await transactionCount(assignedTaskId)).toBe(1)
  expect((await prisma.task.findUniqueOrThrow({ where: { id: assignedTaskId }, select: { status: true } })).status).toBe('COMPLETED')

  const rejectedOrder = await createOrder('rejected-rerent')
  const rejectedAssignment = await post(managerPage, '/api/manager/orders/rerent', { orderId: rejectedOrder.id })
  expect(rejectedAssignment.status).toBe(200)
  const rejectedTaskId = rejectedAssignment.body.task.id as string
  expect((await post(page, '/api/user/tasks', { taskId: rejectedTaskId })).body.task.status).toBe('SUBMITTED')
  const rejectedReview = await post(managerPage, `/api/manager/tasks/${rejectedTaskId}/review`, { decision: 'REJECT' })
  expect(rejectedReview.status).toBe(200)
  expect(rejectedReview.body.status).toBe('REJECTED')
  await expect.poll(() => prisma.task.findUniqueOrThrow({ where: { id: rejectedTaskId }, select: { status: true } })).toEqual({ status: 'REJECTED' })
  expect((await post(page, '/api/user/tasks/settle', { taskId: rejectedTaskId })).status).toBe(400)
  expect((await prisma.order.findUniqueOrThrow({ where: { id: rejectedOrder.id }, select: { status: true } })).status).toBe('RE_RENT_PENDING')
  const sameManagerRerentPage = await browser.newPage()
  await signIn(sameManagerRerentPage, 'user', 'other-same-manager')
  const sameManagerRerentAttempt = await post(sameManagerRerentPage, '/api/user/tasks', { taskId: rejectedTaskId })
  expect(sameManagerRerentAttempt.status).toBe(404)
  expect((await prisma.task.findUniqueOrThrow({ where: { id: rejectedTaskId }, select: { status: true } })).status).toBe('REJECTED')
  expect((await prisma.order.findUniqueOrThrow({ where: { id: rejectedOrder.id }, select: { status: true } })).status).toBe('RE_RENT_PENDING')
  const otherManagerRerentPage = await browser.newPage()
  await signIn(otherManagerRerentPage, 'user', 'other-manager')
  const otherManagerRerentAttempt = await post(otherManagerRerentPage, '/api/user/tasks', { taskId: rejectedTaskId })
  expect(otherManagerRerentAttempt.status).toBe(404)
  expect((await prisma.task.findUniqueOrThrow({ where: { id: rejectedTaskId }, select: { status: true } })).status).toBe('REJECTED')
  expect((await prisma.order.findUniqueOrThrow({ where: { id: rejectedOrder.id }, select: { status: true } })).status).toBe('RE_RENT_PENDING')
  await sameManagerRerentPage.close()
  await otherManagerRerentPage.close()
  const beforeRejectedRetry = await walletBalance()
  expect(await transactionCount(rejectedTaskId)).toBe(0)
  const rerentRetry = await post(page, '/api/user/tasks', { taskId: rejectedTaskId })
  expect(rerentRetry.status).toBe(200)
  expect(rerentRetry.body.task.status).toBe('SUBMITTED')
  expect(await walletBalance()).toBe(beforeRejectedRetry)
  expect(await transactionCount(rejectedTaskId)).toBe(0)
  const rejectedRetryApproval = await post(managerPage, `/api/manager/tasks/${rejectedTaskId}/review`, { decision: 'APPROVE' })
  expect(rejectedRetryApproval.status).toBe(200)
  expect(rejectedRetryApproval.body.status).toBe('VERIFIED')
  const retrySubmittedAt = (await prisma.task.findUniqueOrThrow({ where: { id: rejectedTaskId }, select: { submittedAt: true } })).submittedAt!
  const retryRemaining = Math.max(0, delayForTestSeconds * 1000 - (Date.now() - retrySubmittedAt.getTime()) + 100)
  if (retryRemaining) await new Promise((resolve) => setTimeout(resolve, retryRemaining))
  const retrySettlements = await Promise.all(Array.from({ length: 3 }, () => post(page, '/api/user/tasks/settle', { taskId: rejectedTaskId })))
  expect(retrySettlements.every((result) => result.status === 200 && result.body.completed === true)).toBe(true)
  expect(await transactionCount(rejectedTaskId)).toBe(1)
  expect((await prisma.task.findUniqueOrThrow({ where: { id: rejectedTaskId }, select: { status: true } })).status).toBe('COMPLETED')
  expect((await prisma.order.findUniqueOrThrow({ where: { id: rejectedOrder.id }, select: { status: true } })).status).toBe('RE_RENTED')

  const legacyOrder = await createOrder('legacy-rerent', 'RE_RENT_PENDING')
  const legacyTask = await prisma.task.create({
    data: {
      userId,
      managerId,
      orderId: legacyOrder.id,
      type: 'RE_RENT',
      title: 'Re-Rent Request',
      description: 'Existing submitted legacy request.',
      dayNumber: 0,
      status: 'SUBMITTED',
      assignedAt: new Date(0),
      submittedAt: new Date(Date.now() - 20_000),
    },
  })
  expect((await post(page, '/api/user/tasks/settle', { taskId: legacyTask.id })).status).toBe(409)
  expect(await transactionCount(legacyTask.id)).toBe(0)
  const legacyApproval = await post(managerPage, `/api/manager/tasks/${legacyTask.id}/review`, { decision: 'APPROVE' })
  expect(legacyApproval.body.status).toBe('VERIFIED')
  expect((await post(page, '/api/user/tasks/settle', { taskId: legacyTask.id })).body.completed).toBe(true)
  expect(await transactionCount(legacyTask.id)).toBe(1)

  await managerPage.close()
})
