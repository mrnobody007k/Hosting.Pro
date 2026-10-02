import assert from 'node:assert/strict'
import test from 'node:test'
import { canAccessAdminAccountManagement } from '../lib/admin-permissions'

test('Admin account management controls match the Super Admin-only API policy', () => {
  assert.equal(canAccessAdminAccountManagement('SUPER_ADMIN'), true)
  assert.equal(canAccessAdminAccountManagement('STAFF_ADMIN'), false)
})
