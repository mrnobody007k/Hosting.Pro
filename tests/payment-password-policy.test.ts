import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import bcrypt from 'bcryptjs'

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const registrationRoute = source('../app/api/user/register/route.ts')
const registrationPage = source('../app/register/page.tsx')
const withdrawalRoute = source('../app/api/user/withdrawals/route.ts')
const withdrawalPage = source('../app/user/withdrawals/page.tsx')
const settingsPage = source('../app/user/settings/page.tsx')

test('signup creates separate secure hashes and permits identical account/payment passwords', () => {
  assert.match(registrationPage, /Payment password/)
  assert.match(registrationRoute, /paymentPassword.length < 6 \|\| paymentPassword.length > 200/)
  assert.match(registrationRoute, /paymentPassword !== confirmPaymentPassword/)
  assert.match(registrationRoute, /bcrypt\.hash\(password, 12\)/)
  assert.match(registrationRoute, /bcrypt\.hash\(paymentPassword, 12\)/)
  assert.match(registrationRoute, /passwordHash,\s*paymentPasswordHash,/)
  assert.doesNotMatch(registrationRoute, /paymentPassword\s*!==\s*password|password\s*!==\s*paymentPassword/)

  const auditBlock = registrationRoute.slice(registrationRoute.indexOf('await tx.auditLog.create'), registrationRoute.indexOf('return {\n            user'))
  assert.doesNotMatch(auditBlock, /paymentPassword|passwordHash/)
  assert.doesNotMatch(registrationRoute, /console\.(?:error|warn|log)\([\s\S]{0,100},\s*error\s*\)/i)
  const withdrawalPost = withdrawalRoute.slice(withdrawalRoute.indexOf('export async function POST'))
  assert.doesNotMatch(withdrawalPost, /console\.(?:error|warn|log)\([\s\S]{0,100},\s*error\s*\)/i)
})

test('identical signup values verify against independently salted bcrypt hashes', async () => {
  const sharedValue = 'shared-signup-secret-123'
  const [accountHash, paymentHash] = await Promise.all([
    bcrypt.hash(sharedValue, 12),
    bcrypt.hash(sharedValue, 12),
  ])

  assert.notEqual(accountHash, paymentHash)
  assert.equal(await bcrypt.compare(sharedValue, accountHash), true)
  assert.equal(await bcrypt.compare(sharedValue, paymentHash), true)
  assert.notEqual(accountHash, sharedValue)
  assert.notEqual(paymentHash, sharedValue)
})

test('withdrawal requires a password and verifies the signup hash before reserving funds', () => {
  assert.match(withdrawalPage, /Payment password<input type="password"/)
  assert.match(withdrawalPage, /paymentPassword\s*\}\)/)
  assert.match(withdrawalRoute, /paymentPassword\.length < 6 \|\|\s*paymentPassword\.length > 200/)
  assert.match(withdrawalRoute, /select: \{ paymentPasswordHash: true \}/)
  assert.match(withdrawalRoute, /bcrypt\.compare\(paymentPassword, paymentAccount\.paymentPasswordHash\)/)
  assert.match(withdrawalRoute, /paymentPasswordHash !== paymentAccount\.paymentPasswordHash/)
  assert.ok(withdrawalRoute.indexOf('bcrypt.compare(paymentPassword') < withdrawalRoute.indexOf('await prisma.$transaction'))
  assert.ok(withdrawalRoute.indexOf('bcrypt.compare(paymentPassword') < withdrawalRoute.indexOf('tx.withdrawal.create'))
  assert.match(withdrawalRoute, /Payment passwords can only be created during signup/)
})

test('payment password cannot be created or changed after signup', () => {
  assert.equal(existsSync(new URL('../app/api/user/security/payment-password/route.ts', import.meta.url)), false)
  assert.doesNotMatch(settingsPage, /api\/user\/security\/payment-password|paymentPassword|payment-password-form/i)
  assert.doesNotMatch(settingsPage, /<form/)
  assert.match(settingsPage, /Your payment password is created during signup/)
})

test('login, booking, task, and Re-Rent routes do not request or verify payment passwords', () => {
  const unrelatedRoutes = [
    '../app/api/auth/login/route.ts',
    '../app/api/user/orders/route.ts',
    '../app/api/user/orders/payment/route.ts',
    '../app/api/user/tasks/route.ts',
    '../app/api/user/tasks/settle/route.ts',
    '../app/api/user/tasks/daily/route.ts',
    '../app/api/user/tasks/rerent/route.ts',
    '../app/api/manager/orders/rerent/route.ts',
  ]

  for (const path of unrelatedRoutes) {
    assert.doesNotMatch(source(path), /paymentPassword|payment password|paymentPasswordHash/i, `${path} must not use the withdrawal credential`)
  }
})
