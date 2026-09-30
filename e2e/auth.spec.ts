import { expect, test, type Page } from '@playwright/test'

type TestRole = 'admin' | 'manager' | 'user'

const accounts: Record<TestRole, { email: string; password: string; loginPath: string; panelPath: string; heading: RegExp }> = {
  admin: {
    email: 'test-admin@housing.pro',
    password: process.env.E2E_ADMIN_PASSWORD!,
    loginPath: '/admin-login',
    panelPath: '/admin',
    heading: /housing\.pro admin center/i,
  },
  manager: {
    email: 'test-manager-one@housing.pro',
    password: process.env.E2E_MANAGER_PASSWORD!,
    loginPath: '/manager-login',
    panelPath: '/manager',
    heading: /manager dashboard/i,
  },
  user: {
    email: 'test-customer-one@housing.pro',
    password: process.env.E2E_USER_PASSWORD!,
    loginPath: '/login',
    panelPath: '/user',
    heading: /welcome back/i,
  },
}

async function signIn(page: Page, role: TestRole) {
  const account = accounts[role]
  const accessToken = role === 'manager'
    ? process.env.E2E_MANAGER_ACCESS_TOKEN
    : role === 'user'
      ? process.env.E2E_USER_ACCESS_TOKEN
      : undefined
  await page.goto(accessToken ? `${account.loginPath}/${accessToken}` : account.loginPath)
  await page.getByLabel(role === 'user' ? 'Email address or phone number' : 'Email address').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page).toHaveURL(new RegExp(`${account.panelPath.replace('/', '\\/')}/?$`))
  await expect(page.getByRole('heading', { name: account.heading })).toBeVisible()
}

test('public app loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /discover\. rent\./i })).toBeVisible()
})

test('unauthenticated access redirects to role-specific login', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin-login\/?$/)
  await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible()
})

for (const role of ['admin', 'manager', 'user'] as const) {
  test(`${role} login reaches the ${role} panel`, async ({ page }) => {
    await signIn(page, role)
  })
}

for (const [role, disallowedPath] of [
  ['admin', '/manager'],
  ['manager', '/user'],
  ['user', '/admin'],
] as const) {
  test(`${role} is redirected away from another protected panel`, async ({ page }) => {
    await signIn(page, role)
    await page.goto(disallowedPath)
    await expect(page).toHaveURL(new RegExp(`${accounts[role].panelPath.replace('/', '\\/')}\\/?$`))
  })
}
