import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSuperAdminRepairPatch } from '../scripts/fix-super-admin-email'

test('Super Admin repair can update email and password together in one database write', () => {
  assert.deepEqual(
    buildSuperAdminRepairPatch({
      targetEmail: 'admin@example.test',
      targetPasswordHash: 'new-hash',
      needsEmailUpdate: true,
      needsPasswordUpdate: true,
    }),
    { email: 'admin@example.test', passwordHash: 'new-hash' },
  )
})

test('Super Admin repair leaves unchanged fields out of its update', () => {
  assert.deepEqual(
    buildSuperAdminRepairPatch({
      targetEmail: 'admin@example.test',
      targetPasswordHash: 'current-hash',
      needsEmailUpdate: false,
      needsPasswordUpdate: false,
    }),
    {},
  )
})
