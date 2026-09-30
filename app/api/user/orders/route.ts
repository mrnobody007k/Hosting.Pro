import { NextResponse } from 'next/server'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import {
  readJson,
  requireSameOrigin,
  validMoney,
  handleRequestSecurityError,
} from '@/lib/security'

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

    const body = await readJson<{ propertyId?: unknown; amount?: unknown; quantity?: unknown }>(req)

    // Orders represent one property booking. Never trust a caller supplied
    // quantity, even though the schema stores a single booking per row.
    if (body.quantity !== undefined && body.quantity !== 1 && body.quantity !== '1') {
      return NextResponse.json({ error: 'Each booking must have a quantity of exactly 1.' }, { status: 400 })
    }

    const propertyId = String(body.propertyId || '').trim()

    if (!propertyId || propertyId.length > 100) {
      return NextResponse.json(
        { error: 'A valid property is required.' },
        { status: 400 },
      )
    }

    const requestedAmount = validMoney(body.amount)
    if (!requestedAmount) return NextResponse.json({ error: 'Invalid booking amount.' }, { status: 400 })

    /*
     * Load the authenticated client from the database.
     * The managerId comes from the database relationship,
     * never from the request body.
     */
    const user = await prisma.user.findUnique({
      where: {
        id: session.sub,
      },
      select: {
        id: true,
        managerId: true,
        status: true,
        signupStatus: true,
        membershipStatus: true,
        manager: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    })

    if (
      !user ||
      user.status !== 'ACTIVE' ||
      user.signupStatus !== 'APPROVED' ||
      user.managerId !== session.managerId
    ) {
      return NextResponse.json(
        {
          error:
            'Your account setup is still in progress. You can place bookings once it is complete.',
        },
        { status: 403 },
      )
    }

    if (!user.managerId) {
      return NextResponse.json(
        { error: 'Your account is not ready to place bookings yet.' },
        { status: 400 },
      )
    }

    if (!user.manager || user.manager.status !== 'ACTIVE') {
      return NextResponse.json(
        {
          error: 'This booking option is temporarily unavailable.',
        },
        { status: 403 },
      )
    }

    /*
     * The property is checked independently from the client.
     * A manager-specific property can ONLY be ordered by a
     * client belonging to that same manager.
     *
     * Global properties (managerId = null) are allowed.
     */
    const property = await prisma.property.findUnique({
      where: {
        id: propertyId,
      },
      select: {
        id: true,
        title: true,
        price: true,
        status: true,
        managerId: true,
        manager: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    })

    if (!property || property.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'This property is no longer available.' },
        { status: 404 },
      )
    }

    if (
      property.managerId &&
      property.managerId !== user.managerId
    ) {
      return NextResponse.json(
        {
          error:
            'This property is not currently available for your account.',
        },
        { status: 403 },
      )
    }

    if (
      property.managerId &&
      (!property.manager ||
        property.manager.status !== 'ACTIVE')
    ) {
      return NextResponse.json(
        {
          error:
            'This property is temporarily unavailable.',
        },
        { status: 403 },
      )
    }

    const propertyPrice = new Decimal(property.price.toString())

    if (!propertyPrice.isFinite() || !propertyPrice.gt(0)) {
      return NextResponse.json(
        { error: 'This property has an invalid price.' },
        { status: 500 },
      )
    }
    if (!requestedAmount.eq(propertyPrice)) return NextResponse.json({ error: 'The property price changed. Refresh and confirm the current price.' }, { status: 409 })

    /*
     * IMPORTANT:
     * The order manager is ALWAYS the authenticated client's
     * assigned manager.
     *
     * It is NEVER taken from the property and NEVER accepted
     * from the request body.
     */
    const managerId = user.managerId

    const result = await prisma.$transaction(
      async (tx) => {
        /*
         * Re-check the client inside the transaction.
         * This protects against account/relationship changes
         * between the initial lookup and order creation.
         */
        const currentUser = await tx.user.findUnique({
          where: {
            id: session.sub,
          },
          select: {
            id: true,
            managerId: true,
            status: true,
            signupStatus: true,
            manager: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        })

        if (
          !currentUser ||
          currentUser.status !== 'ACTIVE' ||
          currentUser.signupStatus !== 'APPROVED' ||
          currentUser.managerId !== session.managerId
        ) {
          throw new Error('USER_NOT_APPROVED')
        }

        if (
          currentUser.managerId !== managerId ||
          !currentUser.manager ||
          currentUser.manager.status !== 'ACTIVE'
        ) {
          throw new Error('MANAGER_RELATIONSHIP_CHANGED')
        }

        /*
         * Re-check the property inside the transaction.
         */
        const currentProperty =
          await tx.property.findUnique({
            where: {
              id: property.id,
            },
            select: {
              id: true,
              title: true,
              price: true,
              status: true,
              managerId: true,
              manager: {
                select: {
                  id: true,
                  status: true,
                },
              },
            },
          })

        if (
          !currentProperty ||
          currentProperty.status !== 'ACTIVE'
        ) {
          throw new Error('PROPERTY_UNAVAILABLE')
        }

        if (
          currentProperty.managerId &&
          currentProperty.managerId !==
            currentUser.managerId
        ) {
          throw new Error('PROPERTY_OWNERSHIP_MISMATCH')
        }

        if (
          currentProperty.managerId &&
          (!currentProperty.manager ||
            currentProperty.manager.status !== 'ACTIVE')
        ) {
          throw new Error('PROPERTY_MANAGER_INACTIVE')
        }

        const currentPrice = new Decimal(currentProperty.price.toString())
        if (!currentPrice.isFinite() || !currentPrice.gt(0)) throw new Error('PROPERTY_UNAVAILABLE')
        if (!requestedAmount.eq(currentPrice)) throw new Error('PRICE_CHANGED')

        const orderCode = `HP-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)
          .toUpperCase()}`

        const order = await tx.order.create({
          data: {
            orderCode,
            userId: currentUser.id,

            /*
             * LOCKED OWNERSHIP RULE:
             * User.managerId -> Order.managerId
             */
            managerId: currentUser.managerId,

            propertyId: currentProperty.id,
            amount: currentPrice,
            storehousePrice: 0,
            profit: 0,
            profitRate: new Decimal('1.20'),
            status: 'PAYMENT_PENDING',
            paymentStatus: 'PENDING',
          },
          select: {
            id: true,
            orderCode: true,
            amount: true,
            status: true,
            paymentStatus: true,
            createdAt: true,
            managerId: true,
            userId: true,
            property: {
              select: {
                title: true,
                location: true,
              },
            },
          },
        })

        /*
         * Notification is created in the same transaction.
         * If order creation fails, no orphan notification exists.
         */
        await tx.notification.create({
          data: {
            userId: currentUser.id,
            type: 'ORDER',
            title: 'Booking created',
            message: `Order ${order.orderCode} has been created. Follow the payment instructions shown for your account.`,
          },
        })

        await tx.auditLog.create({
          data: {
            actorType: 'USER',
            actorId: currentUser.id,
            managerId: currentUser.managerId,
            action: 'ORDER_CREATED',
            targetType: 'ORDER',
            targetId: order.id,
            amount: order.amount,
            metadata: {
              orderCode: order.orderCode,
              userId: currentUser.id,
              managerId: currentUser.managerId,
              propertyId: currentProperty.id,
              propertyManagerId:
                currentProperty.managerId,
            },
          },
        })

        return order
      },
      {
        isolationLevel: 'Serializable',
      },
    )

    return NextResponse.json({
      message:
        'Booking created. Complete your payment.',
      order: {
        ...result,
        amount: result.amount.toString(),
      },
      paymentMessage:
        'Payment is completed separately. Follow the instructions shown for your account, then submit your payment reference or proof.',
    })
  } catch (error) {
    const securityResponse =
      handleRequestSecurityError(error)

    if (securityResponse) {
      return securityResponse
    }

    if (
      error instanceof Error &&
      error.message === 'USER_NOT_APPROVED'
    ) {
      return NextResponse.json(
        {
          error:
            'Your account setup is still in progress. You can place bookings once it is complete.',
        },
        { status: 403 },
      )
    }

    if (
      error instanceof Error &&
      error.message ===
        'MANAGER_RELATIONSHIP_CHANGED'
    ) {
      return NextResponse.json(
        {
          error: 'Your account details have changed. Refresh the page and try again.',
        },
        { status: 409 },
      )
    }

    if (
      error instanceof Error &&
      error.message === 'PROPERTY_UNAVAILABLE'
    ) {
      return NextResponse.json(
        {
          error:
            'This property is no longer available.',
        },
        { status: 409 },
      )
    }

    if (error instanceof Error && error.message === 'PRICE_CHANGED') {
      return NextResponse.json({ error: 'The property price changed. Refresh and confirm the current price.' }, { status: 409 })
    }

    if (
      error instanceof Error &&
      error.message ===
        'PROPERTY_OWNERSHIP_MISMATCH'
    ) {
      return NextResponse.json(
        {
          error: 'This property is not currently available for your account.',
        },
        { status: 403 },
      )
    }

    if (
      error instanceof Error &&
      error.message ===
        'PROPERTY_MANAGER_INACTIVE'
    ) {
      return NextResponse.json(
        {
          error: 'This property is temporarily unavailable.',
        },
        { status: 403 },
      )
    }

    if (
      error instanceof Error &&
      error.message === 'PRICE_CHANGED'
    ) {
      return NextResponse.json(
        {
          error:
            'The property price has changed. Please refresh and try again.',
        },
        { status: 409 },
      )
    }

    console.error(
      'USER_ORDER_CREATE_ERROR',
      error,
    )

    return NextResponse.json(
      { error: 'Unable to create booking.' },
      { status: 500 },
    )
  }
}
