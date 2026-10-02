import assert from 'node:assert/strict'
import test from 'node:test'
import { assertAdminBootstrapEmailAvailable, assertProductionAdminProvisioningOptIn, assertSafeDevelopmentSeedTarget, assertSeedExecutionAllowed, assertSuperAdminRepairOptIn, normalizeSuperAdminBootstrap } from '../lib/seed-safety'

const validLocalEnvironment = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://127.0.0.1:5432/housingpro_test',
  ALLOW_HOUSINGPRO_LOCAL_SEED: 'YES',
}

test('development seeding requires explicit opt-in', () => {
  assert.throws(
    () => assertSafeDevelopmentSeedTarget({ ...validLocalEnvironment, ALLOW_HOUSINGPRO_LOCAL_SEED: undefined }),
    /Explicit opt-in required/,
  )
})

test('development seeding accepts only loopback PostgreSQL targets', () => {
  assert.doesNotThrow(() => assertSafeDevelopmentSeedTarget(validLocalEnvironment))
  for (const DATABASE_URL of [
    'postgresql://db.example.test:5432/housingpro',
    'postgresql://127.0.0.1:5432/housingpro?host=db.example.test',
    'postgresql://127.0.0.1:5432/housingpro?hostaddr=192.0.2.10',
    'https://127.0.0.1/database',
  ]) {
    assert.throws(
      () => assertSafeDevelopmentSeedTarget({ ...validLocalEnvironment, DATABASE_URL }),
      /loopback PostgreSQL/,
    )
  }
})

test('development seed guard rejects production mode', () => {
  assert.throws(
    () => assertSafeDevelopmentSeedTarget({ ...validLocalEnvironment, NODE_ENV: 'production' }),
    /disabled in production/,
  )
})

test('production seed requires explicit opt-in and a valid PostgreSQL URL without host overrides', () => {
  const production = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://db.example.test:5432/housingpro',
    ALLOW_HOUSINGPRO_PRODUCTION_SEED: 'YES',
  }
  assert.throws(
    () => assertSeedExecutionAllowed({ ...production, ALLOW_HOUSINGPRO_PRODUCTION_SEED: undefined }),
    /Explicit opt-in required/,
  )
  assert.doesNotThrow(() => assertSeedExecutionAllowed(production))
  assert.throws(
    () => assertSeedExecutionAllowed({ ...production, DATABASE_URL: 'postgresql://127.0.0.1/db?hostaddr=192.0.2.10' }),
    /without host overrides/,
  )
})

test('production environment retrieval requires a local production opt-in before external access', () => {
  assert.throws(() => assertProductionAdminProvisioningOptIn({ NODE_ENV: 'development', ALLOW_HOUSINGPRO_PRODUCTION_SEED: 'YES' }), /NODE_ENV=production/)
  assert.throws(() => assertProductionAdminProvisioningOptIn({ NODE_ENV: 'production' }), /Explicit opt-in required/)
  assert.doesNotThrow(() => assertProductionAdminProvisioningOptIn({ NODE_ENV: 'production', ALLOW_HOUSINGPRO_PRODUCTION_SEED: 'YES' }))
})

test('Super Admin repair requires a separate explicit opt-in', () => {
  assert.throws(() => assertSuperAdminRepairOptIn({}), /Explicit opt-in required/)
  assert.doesNotThrow(() => assertSuperAdminRepairOptIn({ ALLOW_HOUSINGPRO_SUPER_ADMIN_REPAIR: 'YES' }))
})

test('Super Admin bootstrap normalizes email and rejects invalid values before database work', () => {
  assert.deepEqual(
    normalizeSuperAdminBootstrap({ email: '  ADMIN@EXAMPLE.TEST ', name: ' Main Admin ', password: 'twelve-char-password' }),
    { email: 'admin@example.test', name: 'Main Admin', password: 'twelve-char-password' },
  )
  assert.throws(() => normalizeSuperAdminBootstrap({ email: 'not-an-email' }), /valid email address/)
  assert.throws(() => normalizeSuperAdminBootstrap({ name: '   ' }), /1 to 120 characters/)
  assert.throws(() => normalizeSuperAdminBootstrap({ password: 'short' }), /at least 12 characters/)
})

test('Super Admin bootstrap refuses cross-role email collisions before creation', async () => {
  let creates = 0
  const table = (matches: boolean) => ({
    findUnique: async () => matches ? { id: 'existing-account' } : null,
    create: async () => { creates += 1 },
  })
  const database = {
    adminUser: table(false),
    manager: table(true),
    user: table(false),
  } as never

  await assert.rejects(() => assertAdminBootstrapEmailAvailable(database, 'admin@example.test'), /SUPER_ADMIN_EMAIL_ALREADY_IN_USE/)
  assert.equal(creates, 0)
})

test('Super Admin email repair permits its own Admin row but rejects Manager or User collisions', async () => {
  const database = {
    adminUser: { findUnique: async () => ({ id: 'current-admin' }) },
    manager: { findUnique: async () => null },
    user: { findUnique: async () => null },
  } as never
  await assert.doesNotReject(() => assertAdminBootstrapEmailAvailable(database, 'admin@example.test', 'current-admin'))

  const collision = {
    adminUser: { findUnique: async () => ({ id: 'current-admin' }) },
    manager: { findUnique: async () => ({ id: 'manager' }) },
    user: { findUnique: async () => null },
  } as never
  await assert.rejects(() => assertAdminBootstrapEmailAvailable(collision, 'admin@example.test', 'current-admin'), /SUPER_ADMIN_EMAIL_ALREADY_IN_USE/)
})
