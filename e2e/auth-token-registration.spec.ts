import { expect, test, type Page } from '@playwright/test'

const accessToken = process.env.E2E_USER_ACCESS_TOKEN!

async function finishMockRegistration(page: Page) {
  await page.route('**/api/user/register', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true }),
  }))
  await page.getByLabel('Full name').fill('Token Flow Test')
  await page.getByLabel('Age').fill('30')
  await page.getByLabel('Profession').fill('Tester')
  await page.getByLabel('Phone number').fill('+15555550100')
  await page.getByLabel('Email address', { exact: true }).fill('token-flow-test@example.test')
  await page.getByRole('textbox', { name: /^Password/ }).fill('test-password-123')
  await page.getByLabel('Confirm password').fill('test-password-123')
  await page.getByRole('textbox', { name: /^Payment password/ }).fill('different-payment-123')
  await page.getByLabel('Confirm payment password').fill('different-payment-123')
  await page.getByLabel('Account access code').fill('TEST-REFERRAL')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Your account is on its way.' })).toBeVisible()
}

test('valid customer access URL survives registration and returns to tokenized login', async ({ page }) => {
  await page.goto(`/login/${accessToken}`)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await page.getByRole('link', { name: 'Create an account' }).click()
  await expect(page).toHaveURL(/\/register$/)

  await finishMockRegistration(page)
  await page.getByRole('button', { name: 'Continue to sign in' }).click()
  await expect(page).toHaveURL(new RegExp(`/login/${accessToken}$`))
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test('invalid or revoked customer access URL remains rejected', async ({ page }) => {
  const invalidToken = '0'.repeat(64) === accessToken ? '1'.repeat(64) : '0'.repeat(64)
  await page.goto(`/login/${invalidToken}`)
  await expect(page.getByLabel('Email address or phone number')).toHaveCount(0)
})

test('registration without authorized token context cannot bypass protected login', async ({ page }) => {
  await page.goto('/register')
  await finishMockRegistration(page)
  await page.getByRole('button', { name: 'Continue to sign in' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByLabel('Email address or phone number')).toHaveCount(0)
})
