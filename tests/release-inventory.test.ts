import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'

const requiredPaths = [
  'app/api/admin/clients/[id]/signup/route.ts',
  'app/api/manager/signups/route.ts',
  'app/api/internal/scheduler/process/route.ts',
  'app/api/internal/rerent/process/route.ts',
  'app/api/user/tier/route.ts',
  'app/api/user/orders/route.ts',
  'app/api/user/orders/payment/route.ts',
  'app/api/user/orders/[id]/route.ts',
  'app/api/manager/orders/route.ts',
  'app/api/manager/orders/rerent/route.ts',
  'lib/signup-approval.ts',
  'lib/scheduler-auth.ts',
  'lib/scheduler-handler.ts',
  'lib/scheduler-runner.ts',
  'lib/daily-task-scheduler.ts',
  'lib/rerent-scheduler.ts',
  'lib/display-tier.ts',
  'lib/order-cancellation.ts',
  'prisma/schema.prisma',
  'prisma/migrations/0_init/migration.sql',
  'prisma/migrations/20260928013424_add_admin_super_staff_and_login_tokens/migration.sql',
  'prisma/migrations/20260929120000_add_verified_task_status/migration.sql',
  'prisma/migrations/20260930031225_admin_permissions_not_null/migration.sql',
  'prisma/migrations/20261001000000_manager_entered_rerent_return/migration.sql',
  'prisma/migrations/20261002000000_user_display_tier/migration.sql',
  'tests/signup-approval.test.ts',
  'tests/order-cancellation.test.ts',
  'tests/manual-order-payment.test.ts',
  'tests/release-route-policy.test.ts',
  'tests/admin-permissions.test.ts',
  'tests/login-account.test.ts',
  'tests/login-rate-limit.test.ts',
  'tests/security-config.test.ts',
  'tests/scheduler-auth.test.ts',
  'tests/scheduler-handler.test.ts',
  'tests/scheduler-runner.test.ts',
  'tests/scheduler-window.test.ts',
  'tests/rerent-settlement.test.ts',
  'tests/display-tier.test.tsx',
  'tests/seed-safety.test.ts',
  'tests/support-copy.test.ts',
  'e2e/auth-token-registration.spec.ts',
  'e2e/display-tier.spec.ts',
  'e2e/login-rate-limit.spec.ts',
  'e2e/scheduler.spec.ts',
  'e2e/task-verification.spec.ts',
  'e2e/scheduler-test-secret.ts',
  '.env.example',
  'README.md',
  'PROJECT-HANDOVER.md',
  'public/ASSET-CREDITS.md',
  'public/homepage-rental-interior.webp',
]

const handover = readFileSync(new URL('../PROJECT-HANDOVER.md', import.meta.url), 'utf8')
const environmentTemplate = readFileSync(new URL('../.env.example', import.meta.url), 'utf8')
const packageManifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { scripts?: Record<string, string> }
const databaseFreeTests = readdirSync(new URL('../tests/', import.meta.url)).filter((file) => /\.test\.tsx?$/.test(file))

test('release source inventory contains routes, migration chain, tests, runtime docs, and assets', () => {
  const missing = requiredPaths.filter((path) => !existsSync(new URL(`../${path}`, import.meta.url)))
  assert.deepEqual(missing, [], `Missing release inventory paths: ${missing.join(', ')}`)
  assert.deepEqual(
    ['DATABASE_URL', 'AUTH_SECRET', 'SCHEDULER_SERVICE_SECRET'].filter((name) => !new RegExp(`^${name}=`, 'm').test(environmentTemplate)),
    [],
  )
  assert.match(packageManifest.scripts?.['test:unit'] || '', /tests\/\*\.test\.ts/)
  assert.match(packageManifest.scripts?.['test:unit'] || '', /tests\/\*\.test\.tsx/)
  assert.ok(databaseFreeTests.length >= 1, 'the database-free unit test directory is not empty')
  assert.match(packageManifest.scripts?.['test:e2e'] || '', /playwright test/)
})

test('handover records the deployed route mismatch and ambiguous dirty deployment source', () => {
  assert.match(handover, /artifact list did \*\*not\*\* include `api\/admin\/clients\/\[id\]\/signup` or `api\/user\/tier`/)
  assert.match(handover, /gitDirty=1/)
  assert.match(handover, /do not state that signup override is live/i)
  assert.match(handover, /Release-critical source\/file set/)
  assert.match(handover, /app\/api\/admin\/clients\/\[id\]\/signup\/route\.ts/)
  assert.match(handover, /app\/api\/user\/tier\/route\.ts/)
  assert.match(handover, /app\/api\/internal\/scheduler\/process\/route\.ts/)
  assert.match(handover, /Temporary URL and eventual custom-domain procedure/)
})
