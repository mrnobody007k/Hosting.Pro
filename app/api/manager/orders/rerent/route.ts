import { NextResponse } from 'next/server'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import {
  readJson,
  requireSameOrigin,
  handleRequestSecurityError,
} from '@/lib/security'

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
    }>(req)

    const orderId = String(body.orderId || '').trim()

    if (!orderId || orderId.length > 100) {
      return NextResponse.json(
        { error: 'Valid order ID is required.' },
        { status: 400 },
      )
    }

    const result = await prisma.$transaction(
      async (tx) => {
        /*
         * The order must belong to the logged-in manager.
         * The client attached to the order must also belong
         * to that same manager.
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
                propertyUrl: true,
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

        if (order.status !== 'ACTIVE') {
          throw new Error('ORDER_NOT_ACTIVE')
        }
        if (order.paymentStatus !== 'PAID' || !order.paymentVerifiedAt) {
          throw new Error('ORDER_NOT_PAYMENT_VERIFIED')
        }

        /*
         * Re-check for an active Re-Rent task INSIDE the
         * serializable transaction. This prevents two
         * simultaneous manager requests from creating
         * duplicate active tasks.
         */
        const existingTask = await tx.task.findFirst({
          where: {
            orderId: order.id,
            managerId: session.managerId!,
            type: 'RE_RENT',
            status: {
              in: [
                'PENDING',
                'IN_PROGRESS',
                'SUBMITTED',
              ],
            },
          },
          select: {
            id: true,
          },
        })

        if (existingTask) {
          throw new Error('TASK_ALREADY_ACTIVE')
        }

        const setting =
          await tx.platformSetting.findFirst({
            select: {
              rerentProfitRate: true,
            },
          })

        const profitRate = new Decimal(setting?.rerentProfitRate?.toString() ?? '1.20')

        if (
          !profitRate.isFinite() ||
          !profitRate.gt(0) ||
          profitRate.gt(100)
        ) {
          throw new Error('INVALID_PROFIT_RATE')
        }

        const assignedAt = new Date()

        /*
         * Atomically claim the order for Re-Rent.
         */
        const claimed = await tx.order.updateMany({
          where: {
            id: order.id,
            managerId: session.managerId!,
            status: 'ACTIVE',
          },
          data: {
            status: 'RE_RENT_PENDING',
            rerentRequestedAt: assignedAt,
          },
        })

        if (claimed.count !== 1) {
          throw new Error('ORDER_ALREADY_PROCESSED')
        }

        const task = await tx.task.create({
          data: {
            userId: order.userId,
            managerId: session.managerId!,
            orderId: order.id,
            type: 'RE_RENT',
            title: 'Re-Rent Property',
            description:
              'Open the property link, complete the re-rent task, then request successful completion.',
            propertyUrl:
              order.property?.propertyUrl || null,
            dayNumber: 1,
            profitRate: profitRate.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
            profitAmount: 0,
            status: 'PENDING',
            assignedAt,
          },
        })

        await tx.notification.create({
          data: {
            userId: order.userId,
            type: 'TASK',
            title: 'New Re-Rent Task',
            message: `A Re-Rent task has been assigned for order ${order.orderCode}.`,
          },
        })

        await tx.auditLog.create({
          data: {
            actorType: 'MANAGER',
            actorId: session.sub,
            managerId: session.managerId!,
            action: 'RERENT_TASK_ASSIGNED',
            targetType: 'ORDER',
            targetId: order.id,
            amount: order.amount,
            metadata: {
              orderCode: order.orderCode,
              userId: order.userId,
              taskId: task.id,
              profitRate: profitRate.toFixed(2),
            },
          },
        })

        return {
          task,
          orderId: order.id,
          orderCode: order.orderCode,
          profitRate: profitRate.toFixed(2),
        }
      },
      {
        isolationLevel: 'Serializable',
      },
    )

    return NextResponse.json({
      message: 'Re-Rent task assigned successfully.',
      task: {
        ...result.task,
        profitRate: result.task.profitRate.toString(),
        profitAmount: result.task.profitAmount.toString(),
      },
      orderId: result.orderId,
      orderCode: result.orderCode,
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
      error.message === 'ORDER_NOT_ACTIVE'
    ) {
      return NextResponse.json(
        {
          error:
            'Only active orders can receive a re-rent task.',
        },
        { status: 400 },
      )
    }

    if (error instanceof Error && error.message === 'ORDER_NOT_PAYMENT_VERIFIED') {
      return NextResponse.json({ error: 'Payment must be confirmed before assigning this booking activity.' }, { status: 409 })
    }

    if (
      error instanceof Error &&
      error.message === 'TASK_ALREADY_ACTIVE'
    ) {
      return NextResponse.json(
        {
          error:
            'A re-rent task is already active for this order.',
        },
        { status: 409 },
      )
    }

    if (
      error instanceof Error &&
      error.message === 'ORDER_ALREADY_PROCESSED'
    ) {
      return NextResponse.json(
        {
          error:
            'This order has already been processed.',
        },
        { status: 409 },
      )
    }

    if (
      error instanceof Error &&
      error.message === 'INVALID_PROFIT_RATE'
    ) {
      return NextResponse.json(
        {
          error:
            'Platform re-rent profit configuration is invalid.',
        },
        { status: 500 },
      )
    }

    console.error(
      'MANAGER_RERENT_ASSIGN_ERROR',
      error,
    )

    return NextResponse.json(
      {
        error:
          'Unable to assign Re-Rent task.',
      },
      { status: 500 },
    )
  }
}
