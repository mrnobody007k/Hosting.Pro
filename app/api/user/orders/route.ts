import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createWalletBooking, isSingleBookingQuantity } from '@/lib/wallet-booking'
import { getSession } from '@/lib/auth'
import { readJson, requireSameOrigin, validMoney, handleRequestSecurityError } from '@/lib/security'
export async function GET(request: Request) {
  try {
    const session = await getSession()

    if (
      !session ||
      session.role !== 'USER' ||
      !session.managerId
    ) {
      return NextResponse.json(
        { error: 'Unauthorized.' },
        { status: 401 },
      )
    }

    const user = await prisma.user.findFirst({ where: { id: session.sub, managerId: session.managerId }, select: { id: true, status: true, signupStatus: true, manager: { select: { status: true } } } })
    if (!user || user.status !== 'ACTIVE' || user.signupStatus !== 'APPROVED' || user.manager.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Your account setup is still in progress.' }, { status: 403 })
    }

    const params = new URL(request.url).searchParams
    const cursor = params.get('cursor')
    const query = (params.get('q') || '').trim().slice(0, 100)
    const status = params.get('status')
    const paymentStatus = params.get('paymentStatus')
    const validOrderStatuses = ['ALL', 'PENDING', 'COMPLETED', 'RE_RENT', 'PAYMENT_PENDING', 'PAYMENT_SUBMITTED', 'PAYMENT_VERIFIED', 'ACTIVE', 'RE_RENT_PENDING', 'RE_RENTED', 'CANCELLED']
    const validPaymentStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'PAID']
    if ((status && status !== 'ALL' && !validOrderStatuses.includes(status)) || (paymentStatus && paymentStatus !== 'ALL' && !validPaymentStatuses.includes(paymentStatus))) {
      return NextResponse.json({ error: 'Invalid booking filter.' }, { status: 400 })
    }
    if (cursor && (cursor.length > 100 || !(await prisma.order.findFirst({ where: { id: cursor, userId: session.sub, managerId: session.managerId }, select: { id: true } })))) {
      return NextResponse.json({ error: 'Invalid booking page cursor.' }, { status: 400 })
    }
    const orders = await prisma.order.findMany({
      where: {
        userId: session.sub,
        managerId: session.managerId,
        ...(status === 'PENDING' ? { status: { in: ['PAYMENT_PENDING', 'PAYMENT_SUBMITTED', 'PAYMENT_VERIFIED'] as never[] } } : {}),
        ...(status === 'COMPLETED' ? { status: { in: ['RE_RENTED', 'COMPLETED'] as never[] } } : {}),
        ...(status === 'RE_RENT' ? { OR: [
          { status: { in: ['RE_RENT_PENDING', 'RE_RENTED'] as never[] } },
          { tasks: { some: { type: 'RE_RENT' } } },
        ] } : {}),
        ...(status && !['ALL', 'PENDING', 'COMPLETED', 'RE_RENT'].includes(status) ? { status: status as never } : {}),
        ...(paymentStatus && paymentStatus !== 'ALL' ? { paymentStatus: paymentStatus as never } : {}),
        ...(query ? { AND: [{ OR: [
          { orderCode: { contains: query, mode: 'insensitive' as const } },
          { property: { title: { contains: query, mode: 'insensitive' as const } } },
          { property: { location: { contains: query, mode: 'insensitive' as const } } },
        ] }] } : {}),
      },
      select: {
        id: true,
        orderCode: true,
        amount: true,
        profit: true,
        finalReturnAmount: true,
        profitRate: true,
        status: true,
        paymentStatus: true,
        paymentReference: true,
        bookedAt: true,
        paymentSubmittedAt: true,
        paymentVerifiedAt: true,
        activatedAt: true,
        rerentRequestedAt: true,
        rerentedAt: true,
        completedAt: true,
        cancelledAt: true,
        createdAt: true,
        updatedAt: true,
        property: {
          select: {
            id: true,
            title: true,
            location: true,
            imageUrl: true,
            propertyUrl: true,
          },
        },
        tasks: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
          select: {
            id: true,
            type: true,
            title: true,
            description: true,
            propertyUrl: true,
            dayNumber: true,
            profitRate: true,
            profitAmount: true,
            status: true,
            assignedAt: true,
            startedAt: true,
            submittedAt: true,
            completedAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: 25,
    })

    const nextCursor = orders.length === 25 ? orders[orders.length - 1].id : null
    return NextResponse.json({
      orders: orders.map((order) => ({
        ...order,
        amount: order.amount.toString(),
        profit: order.profit.toString(),
        finalReturnAmount: order.finalReturnAmount?.toString() ?? null,
        profitRate: order.profitRate.toString(),
        tasks: order.tasks.map((task) => ({
          ...task,
          profitRate: task.profitRate.toString(),
          profitAmount: task.profitAmount.toString(),
        })),
      })),
      nextCursor,
    })
  } catch (error) {
    console.error('USER_ORDERS_GET_ERROR', error)

    return NextResponse.json(
      { error: 'Unable to load orders.' },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  try {
    requireSameOrigin(req)
    const session = await getSession()
    if (!session || session.role !== 'USER' || !session.managerId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const body = await readJson<{ propertyId?: unknown; expectedPrice?: unknown; amount?: unknown; bookingRequestId?: unknown; quantity?: unknown }>(req)
    if (!isSingleBookingQuantity(body.quantity)) {
      return NextResponse.json({ error: 'Each booking must have a quantity of exactly 1.' }, { status: 400 })
    }

    const propertyId = String(body.propertyId || '').trim()
    if (!propertyId || propertyId.length > 100) return NextResponse.json({ error: 'A valid property is required.' }, { status: 400 })

    const expectedPrice = validMoney(body.expectedPrice ?? body.amount)
    if (!expectedPrice) return NextResponse.json({ error: 'Invalid displayed rent price.' }, { status: 400 })

    const bookingRequestId = String(body.bookingRequestId || '').trim()
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookingRequestId)) {
      return NextResponse.json({ error: 'A valid booking request ID is required. Refresh the page and try again.' }, { status: 400 })
    }

    const order = await createWalletBooking(prisma, {
      userId: session.sub,
      managerId: session.managerId,
      propertyId,
      bookingRequestId,
      expectedPrice,
    })
    return NextResponse.json({
      message: 'Rent was deducted from your wallet and the booking is active.',
      order: { ...order, amount: order.amount.toString() },
    })
  } catch (error) {
    const securityResponse = handleRequestSecurityError(error)
    if (securityResponse) return securityResponse

    const code = error instanceof Error ? error.message : ''
    const errors: Record<string, [string, number]> = {
      USER_NOT_APPROVED: ['Your account setup is still in progress. You can place bookings once it is complete.', 403],
      MANAGER_RELATIONSHIP_CHANGED: ['Your account details have changed. Refresh the page and try again.', 409],
      PROPERTY_UNAVAILABLE: ['This property is no longer available.', 409],
      PROPERTY_OWNERSHIP_MISMATCH: ['This property is not currently available for your account.', 403],
      PROPERTY_MANAGER_INACTIVE: ['This property is temporarily unavailable.', 403],
      PROPERTY_INVALID_PRICE: ['This property has an invalid price.', 500],
      PRICE_CHANGED: ['The property price changed. Refresh and confirm the current rent.', 409],
      WALLET_NOT_FOUND: ['Your wallet could not be found.', 409],
      INSUFFICIENT_BALANCE: ['Your available balance is not enough to get this rent.', 409],
      BOOKING_IDEMPOTENCY_KEY_REUSED: ['This booking request ID was already used for a different request.', 409],
    }
    if (errors[code]) return NextResponse.json({ error: errors[code][0] }, { status: errors[code][1] })

    console.error('USER_ORDER_CREATE_ERROR', error)
    return NextResponse.json({ error: 'Unable to create booking.' }, { status: 500 })
  }
}
