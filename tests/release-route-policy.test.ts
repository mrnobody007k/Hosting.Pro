import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const adminApprovalRoute = readFileSync(new URL('../app/api/admin/clients/[id]/signup/route.ts', import.meta.url), 'utf8')
const managerSignupRoute = readFileSync(new URL('../app/api/manager/signups/route.ts', import.meta.url), 'utf8')
const tierRoute = readFileSync(new URL('../app/api/user/tier/route.ts', import.meta.url), 'utf8')
const displayTierRoute = readFileSync(new URL('../app/api/admin/clients/[id]/route.ts', import.meta.url), 'utf8')
const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8')
const tierMigration = readFileSync(new URL('../prisma/migrations/20261002000000_user_display_tier/migration.sql', import.meta.url), 'utf8')
const rerentMigration = readFileSync(new URL('../prisma/migrations/20261001000000_manager_entered_rerent_return/migration.sql', import.meta.url), 'utf8')
const exampleEnvironment = readFileSync(new URL('../.env.example', import.meta.url), 'utf8')
const loginAccessRoute = readFileSync(new URL('../app/api/admin/login-access/route.ts', import.meta.url), 'utf8')
const nextConfig = readFileSync(new URL('../next.config.mjs', import.meta.url), 'utf8')

test('Super Admin signup override authorizes same-origin and Super Admin before the credit service', () => {
  const originCheck = adminApprovalRoute.indexOf('requireSameOrigin(request)')
  const adminAuth = adminApprovalRoute.indexOf('requireAdminAuth()')
  const superAdminGate = adminApprovalRoute.indexOf("auth.session.adminType !== 'SUPER_ADMIN'")
  const approvalCall = adminApprovalRoute.indexOf('approveSignupTransaction(')

  assert.ok(originCheck >= 0 && originCheck < adminAuth)
  assert.ok(adminAuth < superAdminGate && superAdminGate < approvalCall)
  assert.match(adminApprovalRoute, /type: 'ADMIN', id: auth\.session\.sub/)
  assert.match(adminApprovalRoute, /SIGNUP_WELCOME_BALANCE/)
})

test('Manager signup approval passes the authenticated Manager scope to the shared service', () => {
  assert.match(managerSignupRoute, /session\.role !== 'MANAGER' \|\| !session\.managerId/)
  assert.match(managerSignupRoute, /type: 'MANAGER', id: session\.sub, managerId: session\.managerId/)
  assert.match(managerSignupRoute, /where: \{ id: userId, managerId: session\.managerId/)
})

test('tier reads stay within the authenticated User and tier writes require Admin permission', () => {
  assert.match(tierRoute, /session\.role !== 'USER' \|\| !session\.managerId/)
  assert.match(tierRoute, /where: \{ id: session\.sub, managerId: session\.managerId \}/)
  assert.match(displayTierRoute, /requireAdminAuth\(AdminPermission\.MANAGE_USERS\)/)
  assert.match(displayTierRoute, /canAssignDisplayTier\(auth\.session\)/)
  assert.match(displayTierRoute, /isDisplayTier\(requestedTier\)/)
})

test('tier and Re-Rent release routes have matching schema migrations', () => {
  assert.match(schema, /enum DisplayTier\s*\{\s*GOLD\s+DIAMOND\s+MERCHANT\s*\}/)
  assert.match(schema, /displayTier\s+DisplayTier\?/)
  assert.match(tierMigration, /CREATE TYPE "DisplayTier" AS ENUM \('GOLD', 'DIAMOND', 'MERCHANT'\)/)
  assert.match(tierMigration, /ALTER TABLE "User" ADD COLUMN "displayTier" "DisplayTier"/)
  assert.match(schema, /finalReturnAmount\s+Decimal\?\s+@db\.Decimal\(18, 2\)/)
  assert.match(rerentMigration, /ADD VALUE 'RERENT_SETTLEMENT'/)
  assert.match(rerentMigration, /ADD COLUMN "finalReturnAmount" DECIMAL\(18,2\)/)
})

test('runtime environment template matches the required scheduler/auth/database names', () => {
  for (const name of ['DATABASE_URL', 'AUTH_SECRET', 'SCHEDULER_SERVICE_SECRET']) {
    assert.match(exampleEnvironment, new RegExp(`^${name}=`, 'm'))
  }
  assert.doesNotMatch(exampleEnvironment, /^\s*RERENT_SCHEDULER_SECRET=/m)
})

test('temporary-host and future custom-origin login links retain token-path protections', () => {
  assert.match(loginAccessRoute, /getPublicAppOrigin\(\) \|\| new URL\(req\.url\)\.origin/)
  assert.match(loginAccessRoute, /`\$\{baseUrl\}\/login\/\$\{newToken\}`/)
  assert.match(loginAccessRoute, /`\$\{baseUrl\}\/manager-login\/\$\{newToken\}`/)
  assert.match(nextConfig, /source: '\/login\/:token'[\s\S]*?Referrer-Policy', value: 'no-referrer'[\s\S]*?Cache-Control', value: 'no-store, max-age=0'/)
  assert.match(nextConfig, /source: '\/manager-login\/:token'[\s\S]*?Referrer-Policy', value: 'no-referrer'[\s\S]*?Cache-Control', value: 'no-store, max-age=0'/)
  assert.match(exampleEnvironment, /^# PUBLIC_APP_URL=/m)
})
