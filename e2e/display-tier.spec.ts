import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { expect, test, type Page } from '@playwright/test'
import { storeAccessToken } from '../lib/access-token'

const runId = randomUUID()
const emailPrefix = `tier-api-${runId}`
const password = `TierTest-${randomUUID()}!`
const adminPassword = `TierAdmin-${randomUUID()}!`
const unprivilegedAdminPassword = `TierViewer-${randomUUID()}!`
const managerPassword = `TierManager-${randomUUID()}!`
const userPassword = `TierUser-${randomUUID()}!`
const managerToken = randomBytes(32).toString('hex')
const userToken = randomBytes(32).toString('hex')

let prisma: PrismaClient
let managerId = ''
let userId = ''
let adminId = ''
let unprivilegedAdminId = ''
let settingsId = ''
let fixtureEmails: string[] = []

function localTestDatabaseUrl() {
  const contents = readFileSync(path.join(process.cwd(), '.env.local.test'), 'utf8')
  const value = contents.match(/^\s*LOCAL_TEST_DATABASE_URL\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^(['"])(.*)\1$/, '$2')
  if (!value) throw new Error('Tier API E2E requires LOCAL_TEST_DATABASE_URL.')
  const url = new URL(value)
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''))
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '::1'].includes(host) || database !== 'housingpro_test' || url.searchParams.has('host')) {
    throw new Error('Tier API E2E only permits the disposable local housingpro_test database.')
  }
  return value
}

async function signIn(page: Page, role: 'ADMIN' | 'MANAGER' | 'USER', email: string, credential: string, accessToken?: string) {
  const loginPath = role === 'ADMIN' ? '/admin-login' : role === 'MANAGER' ? `/manager-login/${accessToken}` : `/login/${accessToken}`
  await page.goto(loginPath)
  await page.getByLabel(role === 'USER' ? 'Email address or phone number' : 'Email address').fill(email)
  await page.getByLabel('Password').fill(credential)
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page).toHaveURL(role === 'ADMIN' ? /\/admin\/?$/ : role === 'MANAGER' ? /\/manager\/?$/ : /\/user\/?$/)
}

async function patchTier(page: Page, targetUserId: string, displayTier: unknown) {
  const origin = new URL(page.url()).origin
  return page.context().request.patch(new URL(`/api/admin/clients/${encodeURIComponent(targetUserId)}`, origin).toString(), {
    data: { displayTier },
    headers: { Origin: origin },
  })
}

test.beforeAll(async () => {
  prisma = new PrismaClient({ datasourceUrl: localTestDatabaseUrl() })
  const adminEmail = `${emailPrefix}-admin@housing.pro`
  const viewerEmail = `${emailPrefix}-viewer@housing.pro`
  const managerEmail = `${emailPrefix}-manager@housing.pro`
  const userEmail = `${emailPrefix}-user@housing.pro`
  fixtureEmails = [adminEmail, viewerEmail, managerEmail, userEmail]
  const [adminHash, viewerHash, managerHash, userHash] = await Promise.all([
    bcrypt.hash(adminPassword, 4), bcrypt.hash(unprivilegedAdminPassword, 4),
    bcrypt.hash(managerPassword, 4), bcrypt.hash(userPassword, 4),
  ])

  const manager = await prisma.manager.create({ data: { name: 'Tier API test manager', email: managerEmail, passwordHash: managerHash, referralCode: `tier-${runId}` }, select: { id: true } })
  managerId = manager.id
  const [admin, viewer, user] = await Promise.all([
    prisma.adminUser.create({ data: { name: 'Tier API test admin', email: adminEmail, passwordHash: adminHash, adminType: 'STAFF_ADMIN', permissions: ['MANAGE_USERS'] }, select: { id: true } }),
    prisma.adminUser.create({ data: { name: 'Tier API test viewer', email: viewerEmail, passwordHash: viewerHash, adminType: 'STAFF_ADMIN', permissions: [] }, select: { id: true } }),
    prisma.user.create({ data: { name: 'Tier API test user', email: userEmail, passwordHash: userHash, managerId, status: 'ACTIVE', signupStatus: 'APPROVED', membershipStatus: 'DAY_2' }, select: { id: true, displayTier: true, membershipStatus: true } }),
  ])
  adminId = admin.id
  unprivilegedAdminId = viewer.id
  userId = user.id
  assert.equal(user.displayTier, null)
  assert.equal(user.membershipStatus, 'DAY_2')
  const setting = await prisma.platformSetting.create({ data: {
    managerLoginAccessToken: storeAccessToken(managerToken),
    customerLoginAccessToken: storeAccessToken(userToken),
  }, select: { id: true } })
  settingsId = setting.id
})

test.afterAll(async () => {
  if (!prisma) return
  try {
    if (userId) await prisma.auditLog.deleteMany({ where: { targetType: 'USER', targetId: userId } })
    if (settingsId) await prisma.platformSetting.deleteMany({ where: { id: settingsId } })
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
    if (managerId) await prisma.manager.deleteMany({ where: { id: managerId } })
    if (adminId) await prisma.adminUser.deleteMany({ where: { id: adminId } })
    if (unprivilegedAdminId) await prisma.adminUser.deleteMany({ where: { id: unprivilegedAdminId } })
    if (fixtureEmails.length) {
      await prisma.loginAttempt.deleteMany({ where: { OR: fixtureEmails.map((email) => ({ key: { contains: email } })) } })
    }
  } finally {
    await prisma.$disconnect()
  }
})

test('display-tier API enforces Admin permissions, preserves unassigned users, audits assignments, and renders stored tiers', async ({ browser, request }) => {
  test.setTimeout(120_000)
  const contexts = [] as Awaited<ReturnType<typeof browser.newContext>>[]
  try {
    const adminContext = await browser.newContext(); contexts.push(adminContext)
    const adminPage = await adminContext.newPage()
    await signIn(adminPage, 'ADMIN', `${emailPrefix}-admin@housing.pro`, adminPassword)

    const viewerContext = await browser.newContext(); contexts.push(viewerContext)
    const viewerPage = await viewerContext.newPage()
    await signIn(viewerPage, 'ADMIN', `${emailPrefix}-viewer@housing.pro`, unprivilegedAdminPassword)

    const managerContext = await browser.newContext(); contexts.push(managerContext)
    const managerPage = await managerContext.newPage()
    await signIn(managerPage, 'MANAGER', `${emailPrefix}-manager@housing.pro`, managerPassword, managerToken)

    const userContext = await browser.newContext(); contexts.push(userContext)
    const userPage = await userContext.newPage()
    await signIn(userPage, 'USER', `${emailPrefix}-user@housing.pro`, userPassword, userToken)

    const origin = new URL(adminPage.url()).origin
    const anonymousTier = await request.get(new URL('/api/user/tier', origin).toString())
    expect(anonymousTier.status()).toBe(401)
    const anonymousClient = await request.get(new URL(`/api/admin/clients/${userId}`, origin).toString())
    expect(anonymousClient.status()).toBe(401)

    const initialTier = await userContext.request.get(new URL('/api/user/tier', origin).toString())
    expect(initialTier.status()).toBe(200)
    expect(await initialTier.json()).toEqual({ displayTier: null })
    await userPage.goto('/user/tier')
    await expect(userPage.getByText('Not assigned', { exact: true }).first()).toBeVisible()

    for (const displayTier of ['GOLD', 'DIAMOND', 'MERCHANT'] as const) {
      const response = await patchTier(adminPage, userId, displayTier)
      expect(response.status()).toBe(200)
      expect(await response.json()).toMatchObject({ ok: true, displayTier, changed: true })
      const detail = await adminContext.request.get(new URL(`/api/admin/clients/${userId}`, origin).toString())
      expect((await detail.json()).client.displayTier).toBe(displayTier)
    }

    const invalidTier = await patchTier(adminPage, userId, 'DAY_2')
    expect(invalidTier.status()).toBe(400)
    const invalidId = await patchTier(adminPage, `missing-${runId}`, 'GOLD')
    expect(invalidId.status()).toBe(404)

    const viewerMutation = await patchTier(viewerPage, userId, 'GOLD')
    expect(viewerMutation.status()).toBe(403)
    const viewerRead = await viewerContext.request.get(new URL(`/api/admin/clients/${userId}`, origin).toString())
    expect(viewerRead.status()).toBe(403)

    for (const context of [managerContext, userContext]) {
      const forbiddenMutation = await context.request.patch(new URL(`/api/admin/clients/${userId}`, origin).toString(), {
        data: { displayTier: 'GOLD' }, headers: { Origin: origin },
      })
      expect(forbiddenMutation.status()).toBe(401)
      const forbiddenRead = await context.request.get(new URL(`/api/admin/clients/${userId}`, origin).toString())
      expect(forbiddenRead.status()).toBe(401)
    }

    const storedTier = await userContext.request.get(new URL('/api/user/tier', origin).toString())
    expect(await storedTier.json()).toEqual({ displayTier: 'MERCHANT' })
    await userPage.goto('/user/tier')
    await expect(userPage.getByText('Merchant', { exact: true }).first()).toBeVisible()
    await userPage.goto('/user/profile')
    await expect(userPage.getByText('Display tier', { exact: true })).toBeVisible()
    await expect(userPage.getByText('Merchant', { exact: true }).first()).toBeVisible()

    const audit = await prisma.auditLog.findMany({
      where: { action: 'USER_DISPLAY_TIER_CHANGED', targetType: 'USER', targetId: userId },
      select: { actorType: true, actorId: true, metadata: true },
    })
    expect(audit).toHaveLength(3)
    expect(audit.every((entry) => entry.actorType === 'ADMIN' && entry.actorId === adminId)).toBe(true)
    const userAfter = await prisma.user.findUnique({ where: { id: userId }, select: { displayTier: true, membershipStatus: true } })
    expect(userAfter).toEqual({ displayTier: 'MERCHANT', membershipStatus: 'DAY_2' })
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
  }
})
