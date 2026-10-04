import { createHash } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import { Decimal } from 'decimal.js'

const MAX_SERIALIZATION_ATTEMPTS = 3

export function getWalletBookingOrderCode(userId: string, bookingRequestId: string) {
  const key = createHash('sha256').update(`${userId}:${bookingRequestId}`).digest('hex').slice(0, 32).toUpperCase()
  return `HP-${key}`
}

export function isSingleBookingQuantity(value: unknown) {
  return value === undefined || value === 1 || value === '1'
}

function isPrismaCode(error: unknown, code: string) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === code)
}

function assertSameBooking(existing: { userId: string; managerId: string; propertyId: string }, input: WalletBookingInput) {
  if (existing.userId !== input.userId || existing.managerId !== input.managerId || existing.propertyId !== input.propertyId) {
    throw new Error('BOOKING_IDEMPOTENCY_KEY_REUSED')
  }
}

export type WalletBookingInput = {
  userId: string
  managerId: string
  propertyId: string
  bookingRequestId: string
  expectedPrice: Decimal
  now?: Date
}

const orderSelect = {
  id: true,
  orderCode: true,
  userId: true,
  managerId: true,
  propertyId: true,
  amount: true,
  status: true,
  paymentStatus: true,
  bookedAt: true,
  paymentVerifiedAt: true,
  activatedAt: true,
  createdAt: true,
  property: { select: { title: true, location: true } },
} as const

/**
 * Debit the authenticated client's unreserved wallet balance and create an
 * active wallet-funded booking atomically. The deterministic unique order
 * code is the persisted idempotency key, so no extra database column is
 * needed. All financial effects roll back together if any write fails.
 */
export async function createWalletBooking(prisma: PrismaClient, input: WalletBookingInput) {
  const orderCode = getWalletBookingOrderCode(input.userId, input.bookingRequestId)

  async function replayIfPresent(client: Pick<PrismaClient, 'order'>) {
    const existing = await client.order.findUnique({ where: { orderCode }, select: orderSelect })
    if (!existing) return null
    assertSameBooking(existing, input)
    return existing
  }

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: input.userId },
          select: {
            id: true,
            managerId: true,
            status: true,
            signupStatus: true,
            manager: { select: { status: true } },
          },
        })
        if (!user || user.status !== 'ACTIVE' || user.signupStatus !== 'APPROVED') throw new Error('USER_NOT_APPROVED')
        if (user.managerId !== input.managerId || !user.manager || user.manager.status !== 'ACTIVE') throw new Error('MANAGER_RELATIONSHIP_CHANGED')

        const existing = await replayIfPresent(tx)
        if (existing) return existing

        const property = await tx.property.findUnique({
          where: { id: input.propertyId },
          select: { id: true, title: true, location: true, price: true, status: true, managerId: true, manager: { select: { status: true } } },
        })
        if (!property || property.status !== 'ACTIVE') throw new Error('PROPERTY_UNAVAILABLE')
        if (property.managerId && property.managerId !== user.managerId) throw new Error('PROPERTY_OWNERSHIP_MISMATCH')
        if (property.managerId && property.manager?.status !== 'ACTIVE') throw new Error('PROPERTY_MANAGER_INACTIVE')

        // The database price is authoritative. The submitted price is only a
        // stale-display guard; it is never used to calculate the debit.
        const price = new Decimal(property.price.toString())
        if (!price.isFinite() || !price.gt(0) || price.decimalPlaces() > 2) throw new Error('PROPERTY_INVALID_PRICE')
        if (!input.expectedPrice.eq(price)) throw new Error('PRICE_CHANGED')

        const wallet = await tx.wallet.findUnique({
          where: { userId: user.id },
          select: { balance: true, reservedBalance: true },
        })
        if (!wallet) throw new Error('WALLET_NOT_FOUND')
        const balanceBefore = new Decimal(wallet.balance.toString())
        const reservedBalance = new Decimal(wallet.reservedBalance.toString())
        if (balanceBefore.minus(reservedBalance).lt(price)) throw new Error('INSUFFICIENT_BALANCE')

        // Conditional update protects the available-balance check from a
        // concurrent spend or withdrawal reservation; Serializable retries
        // below re-read the wallet after a write conflict.
        const debit = await tx.wallet.updateMany({
          where: { userId: user.id, balance: { gte: reservedBalance.plus(price) } },
          data: { balance: { decrement: price } },
        })
        if (debit.count !== 1) throw new Error('INSUFFICIENT_BALANCE')

        const now = input.now ?? new Date()
        const balanceAfter = balanceBefore.minus(price)
        const order = await tx.order.create({
          data: {
            orderCode,
            userId: user.id,
            managerId: user.managerId,
            propertyId: property.id,
            amount: price,
            storehousePrice: 0,
            profit: 0,
            profitRate: new Decimal('1.20'),
            status: 'ACTIVE',
            paymentStatus: 'PAID',
            bookedAt: now,
            paymentVerifiedAt: now,
            activatedAt: now,
          },
          select: orderSelect,
        })

        await tx.transaction.create({
          data: {
            userId: user.id,
            managerId: user.managerId,
            type: 'ADJUSTMENT',
            amount: price.negated(),
            balanceBefore,
            balanceAfter,
            reference: order.id,
            note: `Rent debit for order ${order.orderCode}; property ${property.title}`,
          },
        })
        await tx.notification.create({
          data: {
            userId: user.id,
            type: 'ORDER',
            title: 'Get Rent confirmed',
            message: `Rent of ₹${price.toFixed(2)} was deducted from your wallet. Booking ${order.orderCode} is active and visible to your Manager.`,
          },
        })
        await tx.auditLog.create({
          data: {
            actorType: 'USER',
            actorId: user.id,
            managerId: user.managerId,
            action: 'ORDER_CREATED_FROM_WALLET',
            targetType: 'ORDER',
            targetId: order.id,
            amount: price.negated(),
            metadata: { orderCode: order.orderCode, propertyId: property.id, propertyManagerId: property.managerId, fundingSource: 'WALLET' },
          },
        })
        return order
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      if (isPrismaCode(error, 'P2034') && attempt < MAX_SERIALIZATION_ATTEMPTS) continue
      if (isPrismaCode(error, 'P2002')) {
        const existing = await replayIfPresent(prisma)
        if (existing) return existing
        if (attempt < MAX_SERIALIZATION_ATTEMPTS) continue
      }
      throw error
    }
  }
}
