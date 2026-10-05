import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Decimal } from 'decimal.js'
import type { PrismaClient } from '@prisma/client'
import { createWalletBooking, getWalletBookingOrderCode, isSingleBookingQuantity } from '../lib/wallet-booking'

function makeStore(options: { balance?: string; reserved?: string; price?: string; propertyManagerId?: string | null; serializationFailures?: number; failAudit?: boolean } = {}) {
  const state = {
    user: { id: 'user-1', managerId: 'manager-1', status: 'ACTIVE', signupStatus: 'APPROVED', manager: { status: 'ACTIVE' } },
    property: {
      id: 'property-1', title: 'Riverside Apartment', location: 'Pune', price: new Decimal(options.price ?? '250.00'),
      status: 'ACTIVE', managerId: options.propertyManagerId === undefined ? 'manager-1' : options.propertyManagerId,
      manager: { status: 'ACTIVE' },
    },
    wallet: { balance: new Decimal(options.balance ?? '500.00'), reservedBalance: new Decimal(options.reserved ?? '100.00') },
    orders: [] as any[], transactions: [] as any[], notifications: [] as any[], audits: [] as any[],
    attempts: 0,
    serializationFailures: options.serializationFailures ?? 0,
    failAudit: options.failAudit ?? false,
  }
  const tx = {
    user: { findUnique: async () => state.user },
    property: { findUnique: async () => state.property },
    wallet: {
      findUnique: async () => ({ balance: state.wallet.balance, reservedBalance: state.wallet.reservedBalance }),
      updateMany: async ({ where, data }: any) => {
        if (state.wallet.balance.lt(new Decimal(where.balance.gte.toString()))) return { count: 0 }
        state.wallet.balance = state.wallet.balance.minus(new Decimal(data.balance.decrement.toString()))
        return { count: 1 }
      },
    },
    order: {
      findUnique: async ({ where }: any) => state.orders.find((order) => order.orderCode === where.orderCode) ?? null,
      create: async ({ data }: any) => {
        if (state.orders.some((order) => order.orderCode === data.orderCode)) throw Object.assign(new Error('unique'), { code: 'P2002' })
        const order = { ...data, id: `order-${state.orders.length + 1}`, createdAt: new Date(), property: { title: state.property.title, location: state.property.location } }
        state.orders.push(order)
        return order
      },
    },
    transaction: { create: async ({ data }: any) => { state.transactions.push(data); return data } },
    notification: { create: async ({ data }: any) => { state.notifications.push(data); return data } },
    auditLog: { create: async ({ data }: any) => {
      if (state.failAudit) throw new Error('AUDIT_WRITE_FAILED')
      state.audits.push(data)
      return data
    } },
  }
  const prisma = {
    order: tx.order,
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => {
      state.attempts += 1
      if (state.serializationFailures > 0) {
        state.serializationFailures -= 1
        throw Object.assign(new Error('serialization'), { code: 'P2034' })
      }
      const snapshot = {
        balance: state.wallet.balance,
        orderCount: state.orders.length,
        transactionCount: state.transactions.length,
        notificationCount: state.notifications.length,
        auditCount: state.audits.length,
      }
      try {
        return await callback(tx)
      } catch (error) {
        state.wallet.balance = snapshot.balance
        state.orders.length = snapshot.orderCount
        state.transactions.length = snapshot.transactionCount
        state.notifications.length = snapshot.notificationCount
        state.audits.length = snapshot.auditCount
        throw error
      }
    },
  } as unknown as PrismaClient
  return { prisma, state }
}

const request = {
  userId: 'user-1', managerId: 'manager-1', propertyId: 'property-1',
  bookingRequestId: 'dc0f43e7-49a7-4be6-ae45-1e5e71b820f2', expectedPrice: new Decimal('250.00'),
  now: new Date('2026-10-04T00:00:00.000Z'),
}

const apiRoute = readFileSync(new URL('../app/api/user/orders/route.ts', import.meta.url), 'utf8')
const bookingService = readFileSync(new URL('../lib/wallet-booking.ts', import.meta.url), 'utf8')
const homePage = readFileSync(new URL('../app/user/page.tsx', import.meta.url), 'utf8')
const propertyPage = readFileSync(new URL('../app/user/properties/[id]/page.tsx', import.meta.url), 'utf8')
const orderDetailPage = readFileSync(new URL('../app/user/orders/[id]/page.tsx', import.meta.url), 'utf8')
const managerOrdersRoute = readFileSync(new URL('../app/api/manager/orders/route.ts', import.meta.url), 'utf8')
const legacyPaymentRoute = readFileSync(new URL('../app/api/user/orders/payment/route.ts', import.meta.url), 'utf8')

test('Get Rent uses the database price, charges only available funds and writes matching financial records', async () => {
  const { prisma, state } = makeStore()
  const order = await createWalletBooking(prisma, request)

  assert.equal(order.status, 'ACTIVE')
  assert.equal(order.paymentStatus, 'PAID')
  assert.equal(order.managerId, 'manager-1')
  assert.equal(state.wallet.balance.toFixed(2), '250.00')
  assert.equal(state.transactions.length, 1)
  assert.equal(state.transactions[0].type, 'ADJUSTMENT')
  assert.equal(state.transactions[0].amount.toFixed(2), '-250.00')
  assert.equal(state.transactions[0].balanceBefore.toFixed(2), '500.00')
  assert.equal(state.transactions[0].balanceAfter.toFixed(2), '250.00')
  assert.equal(state.transactions[0].reference, order.id)
  assert.match(state.transactions[0].note, /^Rent debit for order /)
  assert.equal(state.notifications.length, 1)
  assert.equal(state.audits.length, 1)
  assert.equal(state.audits[0].actorId, 'user-1')
  assert.equal(state.audits[0].managerId, 'manager-1')
})

test('a repeated request ID replays the original order without a second debit or side effect', async () => {
  const { prisma, state } = makeStore()
  const first = await createWalletBooking(prisma, request)
  const retry = await createWalletBooking(prisma, request)

  assert.equal(retry.id, first.id)
  assert.equal(state.wallet.balance.toFixed(2), '250.00')
  assert.equal(state.orders.length, 1)
  assert.equal(state.transactions.length, 1)
  assert.equal(state.notifications.length, 1)
  assert.equal(state.audits.length, 1)
})

test('a request ID cannot be reused for another property', async () => {
  const { prisma } = makeStore()
  await createWalletBooking(prisma, request)
  await assert.rejects(
    createWalletBooking(prisma, { ...request, propertyId: 'other-property' }),
    { message: 'BOOKING_IDEMPOTENCY_KEY_REUSED' },
  )
})

test('insufficient available balance rejects without changing wallet or creating records', async () => {
  const { prisma, state } = makeStore({ balance: '300.00', reserved: '100.00' })
  await assert.rejects(createWalletBooking(prisma, request), { message: 'INSUFFICIENT_BALANCE' })
  assert.equal(state.wallet.balance.toFixed(2), '300.00')
  assert.equal(state.orders.length, 0)
  assert.equal(state.transactions.length, 0)
  assert.equal(state.notifications.length, 0)
  assert.equal(state.audits.length, 0)
})

test('stale displayed price and another Manager’s property are rejected before debit', async () => {
  const stale = makeStore()
  await assert.rejects(createWalletBooking(stale.prisma, { ...request, expectedPrice: new Decimal('200.00') }), { message: 'PRICE_CHANGED' })
  assert.equal(stale.state.wallet.balance.toFixed(2), '500.00')

  const wrongOwner = makeStore({ propertyManagerId: 'manager-2' })
  await assert.rejects(createWalletBooking(wrongOwner.prisma, request), { message: 'PROPERTY_OWNERSHIP_MISMATCH' })
  assert.equal(wrongOwner.state.wallet.balance.toFixed(2), '500.00')
  assert.equal(wrongOwner.state.orders.length, 0)
})

test('serialization conflicts retry before creating the single booking', async () => {
  const { prisma, state } = makeStore({ serializationFailures: 1 })
  const order = await createWalletBooking(prisma, request)
  assert.ok(order.id)
  assert.equal(state.attempts, 2)
  assert.equal(state.wallet.balance.toFixed(2), '250.00')
  assert.equal(state.orders.length, 1)
})

test('any transaction failure rolls back the wallet debit, order, ledger, and notification', async () => {
  const { prisma, state } = makeStore({ failAudit: true })
  await assert.rejects(createWalletBooking(prisma, request), { message: 'AUDIT_WRITE_FAILED' })
  assert.equal(state.wallet.balance.toFixed(2), '500.00')
  assert.equal(state.orders.length, 0)
  assert.equal(state.transactions.length, 0)
  assert.equal(state.notifications.length, 0)
})

test('the persisted unique order code is deterministic and user-scoped', () => {
  assert.equal(getWalletBookingOrderCode('user-1', request.bookingRequestId), getWalletBookingOrderCode('user-1', request.bookingRequestId))
  assert.notEqual(getWalletBookingOrderCode('user-1', request.bookingRequestId), getWalletBookingOrderCode('user-2', request.bookingRequestId))
})

test('booking accepts only an omitted quantity or exactly one', () => {
  assert.equal(isSingleBookingQuantity(undefined), true)
  assert.equal(isSingleBookingQuantity(1), true)
  assert.equal(isSingleBookingQuantity('1'), true)
  for (const quantity of [0, 2, '0', '2', null, true, [], {}]) {
    assert.equal(isSingleBookingQuantity(quantity), false)
  }
  assert.match(apiRoute, /isSingleBookingQuantity\(body\.quantity\)/)
})

test('Get Rent UI sends stable request IDs and uses server-confirmed database pricing', () => {
  assert.match(apiRoute, /createWalletBooking\(prisma,\s*\{[\s\S]*userId: session\.sub,[\s\S]*managerId: session\.managerId,[\s\S]*expectedPrice/)
  assert.match(apiRoute, /bookingRequestId/)
  assert.match(homePage, /getWalletBookingRequestId\(property\.id\)/)
  assert.match(propertyPage, /getWalletBookingRequestId\(property\.id\)/)
  assert.match(homePage, /expectedPrice: String\(property\.price\)/)
  assert.match(propertyPage, /expectedPrice: String\(property\.price\)/)
  assert.match(homePage, /"Book Now"/)
  assert.match(propertyPage, /`Book Now · \$\{money\(property\.price\)\}`/)
  assert.match(bookingService, /if \(!input\.expectedPrice\.eq\(price\)\)/)
  assert.doesNotMatch(bookingService, /price\.minus\(input\.expectedPrice\)/)
})

test('Manager order isolation and legacy payment review cannot debit a new wallet booking again', () => {
  assert.match(managerOrdersRoute, /managerId: session\.managerId,[\s\S]*user: \{ managerId: session\.managerId \}/)
  assert.match(legacyPaymentRoute, /session\.role !==\s*'USER'[\s\S]*!session\.managerId/)
  assert.match(legacyPaymentRoute, /id: orderId,[\s\S]*userId: session\.sub,[\s\S]*managerId: session\.managerId/)
  assert.match(legacyPaymentRoute, /id: current\.id,[\s\S]*userId: session\.sub,[\s\S]*managerId:\s*session\.managerId/)
  assert.match(legacyPaymentRoute, /order\.status !==[\s\S]*'PAYMENT_PENDING'/)
  assert.match(legacyPaymentRoute, /'PAYMENT_SUBMITTED'/)
  assert.match(legacyPaymentRoute, /paymentStatus: 'PENDING'/)
  assert.match(orderDetailPage, /booking\?\.status === "PAYMENT_PENDING" \|\| booking\?\.status === "PAYMENT_SUBMITTED"/)
  assert.match(managerOrdersRoute, /order\.status !== 'PAYMENT_SUBMITTED'[\s\S]*order\.paymentStatus !== 'PENDING'/)
  assert.match(managerOrdersRoute, /paymentStatus: 'PAID'/)
  assert.match(managerOrdersRoute, /status: 'ACTIVE'/)
  assert.match(bookingService, /status: 'ACTIVE',[\s\S]*paymentStatus: 'PAID'/)
})
