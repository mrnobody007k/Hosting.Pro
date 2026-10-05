import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { canManagerCancelOrderStatus, MANAGER_CANCELLABLE_ORDER_STATUSES } from '../lib/order-cancellation'

const managerOrderRoute = readFileSync(new URL('../app/api/manager/orders/route.ts', import.meta.url), 'utf8')

test('Manager cancellation keeps existing status eligibility without defining refund policy', () => {
  assert.deepEqual(MANAGER_CANCELLABLE_ORDER_STATUSES, ['PAYMENT_PENDING', 'PAYMENT_SUBMITTED', 'PAYMENT_VERIFIED', 'ACTIVE', 'RE_RENT_PENDING'])
  for (const status of MANAGER_CANCELLABLE_ORDER_STATUSES) {
    assert.equal(canManagerCancelOrderStatus(status), true, `${status} remains cancellable by the existing Manager action`)
  }
  for (const status of ['COMPLETED', 'RE_RENTED', 'CANCELLED', 'UNRECOGNIZED']) {
    assert.equal(canManagerCancelOrderStatus(status), false, `${status} is not an allowed cancellation state`)
  }
})

test('cancellation changes order state and audit/notification only; it never refunds or reverses wallet ledger', () => {
  const start = managerOrderRoute.indexOf("if (action === 'CANCEL') {")
  const end = managerOrderRoute.indexOf("if (\n          order.status !== 'PAYMENT_SUBMITTED'", start)
  assert.ok(start >= 0 && end > start, 'the Manager cancellation branch is present')
  const cancellation = managerOrderRoute.slice(start, end)
  assert.match(cancellation, /status: 'CANCELLED'/)
  assert.match(cancellation, /tx\.notification\.create/)
  assert.match(cancellation, /tx\.auditLog\.create/)
  assert.doesNotMatch(cancellation, /(?:tx\.)?(?:wallet|transaction)\.(?:update|updateMany|create|createMany)/i)
  assert.doesNotMatch(cancellation, /refund|reverse|compensat/i)
})
