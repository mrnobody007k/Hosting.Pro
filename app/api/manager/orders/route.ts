import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import {
  readJson,
  requireSameOrigin,
  handleRequestSecurityError,
} from '@/lib/security'
import { canManagerCancelOrderStatus, MANAGER_CANCELLABLE_ORDER_STATUSES } from '@/lib/order-cancellation'

export async function GET(request: Request) {
  try {
    const session = await getSession()

    if (
      !session ||
      session.role !== 'MANAGER' ||
      !session.managerId
    ) {
      return NextResponse.json(
        { error: 'Unauthorized.' },
        { status: 401 },
      )
    }

    const params = new URL(request.url).searchParams
    const query = (params.get('q') || '').trim().slice(0, 100)
    const status = (params.get('status') || 'ALL').toUpperCase()
    const cursor = params.get('cursor')
    const allowedStatuses = ['ALL', 'PAYMENT_PENDING', 'PAYMENT_SUBMITTED', 'PAYMENT_VERIFIED', 'ACTIVE', 'RE_RENT_PENDING', 'RE_RENTED', 'COMPLETED', 'CANCELLED']
    if (!allowedStatuses.includes(status)) return NextResponse.json({ error: 'Invalid order filter.' }, { status: 400 })
    if (cursor && (cursor.length > 100 || !(await prisma.order.findFirst({ where: { id: cursor, managerId: session.managerId }, select: { id: true } })))) {
      return NextResponse.json({ error: 'Invalid order page cursor.' }, { status: 400 })
    }

    const [manager, orders] = await Promise.all([prisma.manager.findUnique({ where: { id: session.managerId }, select: { name: true } }), prisma.order.findMany({
      where: {
        managerId: session.managerId,
        user: { managerId: session.managerId },
        ...(status !== 'ALL' ? { status: status as 'PAYMENT_PENDING' | 'PAYMENT_SUBMITTED' | 'PAYMENT_VERIFIED' | 'ACTIVE' | 'RE_RENT_PENDING' | 'RE_RENTED' | 'COMPLETED' | 'CANCELLED' } : {}),
        ...(query ? { OR: [
          { orderCode: { contains: query, mode: 'insensitive' as const } },
          { user: { name: { contains: query, mode: 'insensitive' as const } } },
          { user: { email: { contains: query, mode: 'insensitive' as const } } },
          { property: { title: { contains: query, mode: 'insensitive' as const } } },
        ] } : {}),
      },
      select: {
        id: true, orderCode: true, amount: true, storehousePrice: true, profit: true, finalReturnAmount: true, profitRate: true, status: true,
        paymentStatus: true, paymentReference: true, paymentProofUrl: true, paymentSubmittedAt: true,
        paymentVerifiedAt: true, createdAt: true, updatedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        property: {
          select: {
            id: true,
            title: true,
            location: true,
            price: true,
          },
        },
        tasks: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 5,
          select: { id: true, type: true, title: true, dayNumber: true, status: true, profitRate: true, profitAmount: true, assignedAt: true, submittedAt: true, completedAt: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: 26,
    })])

    const hasMore = orders.length > 25
    const page = orders.slice(0, 25)

    return NextResponse.json({
      manager,
      orders: page.map((order) => ({
        ...order,
        amount: order.amount.toString(),
        storehousePrice: order.storehousePrice.toString(),
        profit: order.profit.toString(),
        finalReturnAmount: order.finalReturnAmount?.toString() ?? null,
        profitRate: order.profitRate.toString(),
        property: order.property
          ? {
              ...order.property,
              price: order.property.price.toString(),
            }
          : null,
        tasks: order.tasks.map((task) => ({
          ...task,
          profitRate: task.profitRate.toString(),
          profitAmount: task.profitAmount.toString(),
        })),
      })),
      nextCursor: hasMore ? page.at(-1)?.id || null : null,
    })
  } catch (error) {
    console.error('MANAGER_ORDERS_GET_ERROR', error)

    return NextResponse.json(
      { error: 'Unable to load manager orders.' },
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
      session.role !== 'MANAGER' ||
      !session.managerId
    ) {
      return NextResponse.json(
        { error: 'Unauthorized.' },
        { status: 401 },
      )
    }

    const body = await readJson<{
      orderId?: unknown
      action?: unknown
      paymentReference?: unknown
    }>(req)

    const orderId = String(body.orderId || '').trim()
    const action = String(body.action || '')
      .trim()
      .toUpperCase()

    const paymentReference = String(
      body.paymentReference || '',
    )
      .trim()
      .slice(0, 500)

    if (!orderId || orderId.length > 100) {
      return NextResponse.json(
        { error: 'Valid order ID is required.' },
        { status: 400 },
      )
    }

    if (
      !['VERIFY_PAYMENT', 'REJECT_PAYMENT', 'CANCEL'].includes(action)
    ) {
      return NextResponse.json(
        { error: 'Invalid order action.' },
        { status: 400 },
      )
    }

    const result = await prisma.$transaction(
      async (tx) => {
        /*
         * Ownership is checked through BOTH:
         *
         * Order.managerId === session.managerId
         * User.managerId === session.managerId
         *
         * Therefore changing an orderId can never give one
         * manager access to another manager's client's order.
         */
        const order = await tx.order.findFirst({
          where: {
            id: orderId,
            managerId: session.managerId!,
          },
          include: {
            user: {
              select: {
                id: true,
                managerId: true,
                status: true,
                signupStatus: true,
              },
            },
            property: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        })

        if (!order) {
          throw new Error('ORDER_NOT_FOUND')
        }

        if (order.user.managerId !== session.managerId) {
          throw new Error('OWNERSHIP_MISMATCH')
        }

        if (order.user.status !== 'ACTIVE' || order.user.signupStatus !== 'APPROVED') {
          throw new Error('USER_INACTIVE')
        }

        if (action === 'REJECT_PAYMENT') {
          if (order.status !== 'PAYMENT_SUBMITTED' || order.paymentStatus !== 'PENDING' || (!order.paymentReference?.trim() && !order.paymentProofUrl?.trim())) {
            throw new Error('PAYMENT_NOT_PENDING')
          }
          const cancelledAt = new Date()
          const rejected = await tx.order.updateMany({
            where: { id: order.id, managerId: session.managerId!, status: 'PAYMENT_SUBMITTED', paymentStatus: 'PENDING' },
            data: { status: 'CANCELLED', paymentStatus: 'REJECTED', cancelledAt },
          })
          if (rejected.count !== 1) throw new Error('ORDER_ALREADY_PROCESSED')
          await tx.notification.create({ data: { userId: order.userId, type: 'WARNING', title: 'Payment not verified', message: `Payment for order ${order.orderCode} could not be verified and the booking was cancelled. Review your booking history for details.` } })
          await tx.auditLog.create({ data: { actorType: 'MANAGER', actorId: session.sub, managerId: session.managerId!, action: 'ORDER_PAYMENT_REJECTED', targetType: 'ORDER', targetId: order.id, amount: order.amount, metadata: { orderCode: order.orderCode, userId: order.userId, previousStatus: order.status, paymentReference: order.paymentReference || null } } })
          return { type: 'REJECT_PAYMENT' as const, order: { ...order, status: 'CANCELLED' as const, paymentStatus: 'REJECTED' as const, cancelledAt } }
        }

        if (action === 'CANCEL') {
          if (order.status !== 'CANCELLED' && !canManagerCancelOrderStatus(order.status)) {
            throw new Error('CANNOT_CANCEL_COMPLETED')
          }

          if (order.status === 'CANCELLED') {
            throw new Error('ORDER_ALREADY_PROCESSED')
          }

          const cancelledAt = new Date()

          const cancelled = await tx.order.updateMany({
            where: {
              id: order.id,
              managerId: session.managerId!,
              status: { in: [...MANAGER_CANCELLABLE_ORDER_STATUSES] },
            },
            data: {
              status: 'CANCELLED',
              cancelledAt,
            },
          })

          if (cancelled.count !== 1) {
            throw new Error('ORDER_ALREADY_PROCESSED')
          }

          await tx.notification.create({
            data: {
              userId: order.userId,
              type: 'ORDER',
              title: 'Order cancelled',
              message: `Order ${order.orderCode} has been cancelled by your manager.`,
            },
          })

          await tx.auditLog.create({
            data: {
              actorType: 'MANAGER',
              actorId: session.sub,
              managerId: session.managerId!,
              action: 'ORDER_CANCELLED',
              targetType: 'ORDER',
              targetId: order.id,
              amount: order.amount,
              metadata: {
                orderCode: order.orderCode,
                userId: order.userId,
                previousStatus: order.status,
                reason: 'Manager cancellation',
              },
            },
          })

          return {
            type: 'CANCEL' as const,
            order: {
              ...order,
              status: 'CANCELLED',
              cancelledAt,
            },
          }
        }

        if (
          order.status !== 'PAYMENT_SUBMITTED' ||
          order.paymentStatus !== 'PENDING' ||
          (!order.paymentReference?.trim() && !order.paymentProofUrl?.trim())
        ) {
          throw new Error('PAYMENT_NOT_PENDING')
        }

        const verifiedAt = new Date()

        const updated = await tx.order.updateMany({
          where: {
            id: order.id,
            managerId: session.managerId!,
            status: 'PAYMENT_SUBMITTED',
            paymentStatus: 'PENDING',
            OR: [
              { paymentReference: { not: null } },
              { paymentProofUrl: { not: null } },
            ],
          },
          data: {
            status: 'ACTIVE',
            paymentStatus: 'PAID',
            paymentReference:
              paymentReference ||
              order.paymentReference,
            paymentVerifiedAt: verifiedAt,
            activatedAt: verifiedAt,
          },
        })

        if (updated.count !== 1) {
          throw new Error('ORDER_ALREADY_PROCESSED')
        }

        const updatedOrder =
          await tx.order.findUnique({
            where: {
              id: order.id,
            },
          })

        if (!updatedOrder) {
          throw new Error('ORDER_NOT_FOUND')
        }

        await tx.notification.create({
          data: {
            userId: order.userId,
            type: 'ORDER',
            title: 'Payment verified',
            message: `Payment for order ${order.orderCode} has been verified. Your order is now active.`,
          },
        })

        await tx.auditLog.create({
          data: {
            actorType: 'MANAGER',
            actorId: session.sub,
            managerId: session.managerId!,
            action: 'ORDER_PAYMENT_VERIFIED',
            targetType: 'ORDER',
            targetId: order.id,
            amount: order.amount,
            metadata: {
              orderCode: order.orderCode,
              userId: order.userId,
              paymentReference:
                paymentReference ||
                order.paymentReference ||
                null,
              previousStatus: order.status,
            },
          },
        })

        return {
          type: 'VERIFY_PAYMENT' as const,
          order: updatedOrder,
        }
      },
      {
        isolationLevel: 'Serializable',
      },
    )

    if (result.type === 'CANCEL' || result.type === 'REJECT_PAYMENT') {
      return NextResponse.json({
        message: result.type === 'REJECT_PAYMENT' ? 'Payment rejected and order cancelled.' : 'Order cancelled successfully.',
        order: {
          ...result.order,
          amount: result.order.amount.toString(),
        },
      })
    }

    return NextResponse.json({
      message:
        'Payment verified and order activated.',
      order: {
        ...result.order,
        amount: result.order.amount.toString(),
      },
    })
  } catch (error) {
    const securityResponse =
      handleRequestSecurityError(error)

    if (securityResponse) {
      return securityResponse
    }

    if (
      error instanceof Error &&
      error.message === 'ORDER_NOT_FOUND'
    ) {
      return NextResponse.json(
        { error: 'Order not found.' },
        { status: 404 },
      )
    }

    if (
      error instanceof Error &&
      error.message === 'OWNERSHIP_MISMATCH'
    ) {
      return NextResponse.json(
        {
          error:
            'This order does not belong to your client.',
        },
        { status: 403 },
      )
    }

    if (
      error instanceof Error &&
      error.message === 'USER_INACTIVE'
    ) {
      return NextResponse.json(
        {
          error:
            'This client account is not currently active.',
        },
        { status: 403 },
      )
    }

    if (
      error instanceof Error &&
      error.message === 'CANNOT_CANCEL_COMPLETED'
    ) {
      return NextResponse.json(
        {
          error:
            'Completed orders cannot be cancelled.',
        },
        { status: 400 },
      )
    }

    if (
      error instanceof Error &&
      error.message === 'PAYMENT_NOT_PENDING'
    ) {
      return NextResponse.json(
        {
          error:
            'This order is not waiting for payment verification.',
        },
        { status: 400 },
      )
    }

    if (
      error instanceof Error &&
      error.message === 'ORDER_ALREADY_PROCESSED'
    ) {
      return NextResponse.json(
        {
          error:
            'Order has already been processed.',
        },
        { status: 409 },
      )
    }

    console.error(
      'MANAGER_ORDER_ACTION_ERROR',
      error,
    )

    return NextResponse.json(
      {
        error:
          'Unable to process order action.',
      },
      { status: 500 },
    )
  }
}
