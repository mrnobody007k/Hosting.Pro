import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const orderRoute = readFileSync(new URL('../app/api/user/orders/route.ts', import.meta.url), 'utf8')
const dashboard = readFileSync(new URL('../app/user/page.tsx', import.meta.url), 'utf8')
const paymentRoute = readFileSync(new URL('../app/api/user/orders/payment/route.ts', import.meta.url), 'utf8')
const orderDetail = readFileSync(new URL('../app/user/orders/[id]/page.tsx', import.meta.url), 'utf8')
const support = readFileSync(new URL('../app/user/support/page.tsx', import.meta.url), 'utf8')
const managerOrderRoute = readFileSync(new URL('../app/api/manager/orders/route.ts', import.meta.url), 'utf8')
const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8')

test('booking creation preserves offline payment and Manager verification state', () => {
  assert.match(orderRoute, /status: 'PAYMENT_PENDING',\s*paymentStatus: 'PENDING'/)
  assert.match(orderRoute, /Follow the payment instructions shown for your account, then submit your payment reference or proof/)
  assert.doesNotMatch(orderRoute, /wallet\.(?:findUnique|updateMany)/)
  assert.doesNotMatch(orderRoute, /tx\.transaction\.create/)
  assert.doesNotMatch(orderRoute, /status: 'ACTIVE',\s*paymentStatus: 'PAID'/)
  assert.match(schema, /enum OrderStatus\s*\{[\s\S]*PAYMENT_PENDING[\s\S]*PAYMENT_SUBMITTED[\s\S]*PAYMENT_VERIFIED[\s\S]*ACTIVE/)
  assert.match(schema, /enum RequestStatus\s*\{\s*PENDING\s+APPROVED\s+REJECTED\s+PAID\s*\}/)
  assert.match(schema, /paymentStatus\s+RequestStatus\s+@default\(PENDING\)/)
})

test('dashboard links a new booking to the owned manual-payment form', () => {
  assert.match(dashboard, /setBookingOrderId\(typeof json\.order\?\.id === "string" \? json\.order\.id : null\)/)
  assert.match(dashboard, /user\/orders\/\$\{encodeURIComponent\(bookingOrderId\)\}/)
  assert.match(dashboard, /submit your payment reference or proof for Manager review/)
  assert.match(paymentRoute, /where: \{\s*id: orderId,\s*userId: session\.sub,\s*managerId: session\.managerId/)
  assert.match(orderDetail, /fetch\("\/api\/user\/orders\/payment"/)
  assert.match(orderDetail, /canSubmitPayment = booking\?\.status === "PAYMENT_PENDING"/)
  assert.match(managerOrderRoute, /order\.status !== 'PAYMENT_SUBMITTED'[\s\S]*order\.paymentStatus !== 'PENDING'/)
  assert.match(managerOrderRoute, /paymentStatus: 'PAID'/)
  assert.match(managerOrderRoute, /status: 'ACTIVE'/)
  assert.match(support, /Manager reviews the payment before the booking is activated/)
})
