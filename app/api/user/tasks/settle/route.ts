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
      session.role !== 'USER' ||
      !session.managerId
    ) {
      return NextResponse.json(
        { error: 'Unauthorized.' },
        { status: 401 },
      )
    }

    const body = await readJson<{
      taskId?: unknown
    }>(req)

    const taskId = String(body.taskId || '').trim()

    if (!taskId || taskId.length > 100) {
      return NextResponse.json(
        { error: 'Valid task ID is required.' },
        { status: 400 },
      )
    }

    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        userId: session.sub,
        managerId: session.managerId,
        type: 'RE_RENT',
      },
      include: {
        order: true,
        user: {
          select: {
            id: true,
            managerId: true,
            status: true,
            signupStatus: true,
            manager: { select: { status: true } },
          },
        },
      },
    })

    if (!task || !task.order) {
      return NextResponse.json(
        { error: 'Re-Rent task not found.' },
        { status: 404 },
      )
    }

    if (
      task.user.managerId !== session.managerId ||
      task.order.managerId !== session.managerId ||
      task.order.userId !== session.sub
    ) {
      return NextResponse.json(
        {
          error:
            'This task is not associated with your account.',
        },
        { status: 403 },
      )
    }

    if (task.user.status !== 'ACTIVE' || task.user.signupStatus !== 'APPROVED' || task.user.manager.status !== 'ACTIVE') {
      return NextResponse.json(
        {
          error:
            'Your account is not currently active.',
        },
        { status: 403 },
      )
    }

    if (
      task.status === 'COMPLETED' &&
      task.order.status === 'RE_RENTED'
    ) {
      return NextResponse.json({
        message:
          'Your order has been re-rented successfully.',
        completed: true,
        profit: task.profitAmount.toString(),
      })
    }

    if (task.status !== 'SUBMITTED') {
      return NextResponse.json(
        {
          error:
            'The Re-Rent request has not been submitted yet.',
        },
        { status: 400 },
      )
    }

    if (task.order.status !== 'RE_RENT_PENDING') {
      return NextResponse.json(
        {
          error:
            'This order is not waiting for Re-Rent settlement.',
        },
        { status: 400 },
      )
    }

    const requestedAt =
      task.order.rerentRequestedAt ||
      task.submittedAt ||
      null

    if (!requestedAt) {
      return NextResponse.json(
        {
          error:
            'Re-Rent processing time is not available yet.',
        },
        { status: 400 },
      )
    }

    const setting =
      await prisma.platformSetting.findFirst({
        select: {
          rerentDelaySeconds: true,
        },
      })

    const delaySeconds = Number(
      setting?.rerentDelaySeconds ?? 90,
    )

    if (
      !Number.isFinite(delaySeconds) ||
      delaySeconds < 0 ||
      delaySeconds > 86400
    ) {
      return NextResponse.json(
        {
          error:
            'Platform Re-Rent processing configuration is invalid.',
        },
        { status: 500 },
      )
    }

    const elapsedSeconds =
      (Date.now() - requestedAt.getTime()) / 1000

    if (elapsedSeconds < delaySeconds) {
      const remainingSeconds = Math.max(
        1,
        Math.ceil(delaySeconds - elapsedSeconds),
      )

      return NextResponse.json({
        completed: false,
        processing: true,
        remainingSeconds,
        message: `Your Re-Rent request is processing. Please wait ${remainingSeconds} seconds.`,
      })
    }

    const result = await prisma.$transaction(
      async (tx) => {
        /*
         * Re-check the entire ownership chain inside the
         * transaction:
         *
         * USER -> MANAGER -> TASK -> ORDER
         */
        const currentTask =
          await tx.task.findFirst({
            where: {
              id: task.id,
              userId: session.sub,
              managerId: session.managerId,
              type: 'RE_RENT',
            },
            include: {
              order: true,
              user: {
                select: {
                  id: true,
                  managerId: true,
                  status: true,
                  signupStatus: true,
                  manager: { select: { status: true } },
                },
              },
            },
          })

        if (!currentTask || !currentTask.order) {
          throw new Error('TASK_NOT_FOUND')
        }

        if (
          currentTask.user.managerId !==
            session.managerId ||
          currentTask.order.managerId !==
            session.managerId ||
          currentTask.order.userId !== session.sub
        ) {
          throw new Error('OWNERSHIP_MISMATCH')
        }

        if (currentTask.user.status !== 'ACTIVE' || currentTask.user.signupStatus !== 'APPROVED' || currentTask.user.manager.status !== 'ACTIVE') {
          throw new Error('USER_INACTIVE')
        }

        if (
          currentTask.status === 'COMPLETED' &&
          currentTask.order.status === 'RE_RENTED'
        ) {
          return {
            task: currentTask,
            order: currentTask.order,
          profit: currentTask.profitAmount.toString(),
            alreadyCompleted: true,
          }
        }

        if (
          currentTask.status !== 'SUBMITTED' ||
          currentTask.order.status !==
            'RE_RENT_PENDING'
        ) {
          throw new Error('TASK_ALREADY_PROCESSED')
        }

        /*
         * Atomic claim:
         *
         * Only one concurrent request can change
         * SUBMITTED -> COMPLETED.
         *
         * This is the critical protection against
         * double wallet credit.
         */
        const claimed =
          await tx.task.updateMany({
            where: {
              id: currentTask.id,
              userId: session.sub,
              managerId: session.managerId,
              status: 'SUBMITTED',
            },
            data: {
              status: 'IN_PROGRESS',
              startedAt: new Date(),
            },
          })

        if (claimed.count !== 1) {
          throw new Error('TASK_ALREADY_PROCESSED')
        }

        /*
         * Re-check the order after claiming the task.
         */
        const currentOrder =
          await tx.order.findFirst({
            where: {
              id: currentTask.order.id,
              userId: session.sub,
              managerId: session.managerId,
              status: 'RE_RENT_PENDING',
            },
            select: {
              id: true,
              userId: true,
              managerId: true,
              orderCode: true,
              amount: true,
              paymentStatus: true,
              paymentVerifiedAt: true,
              status: true,
              rerentRequestedAt: true,
            },
          })

        if (!currentOrder) {
          throw new Error('ORDER_ALREADY_PROCESSED')
        }
        if (currentOrder.paymentStatus !== 'PAID' || !currentOrder.paymentVerifiedAt) {
          throw new Error('PAYMENT_NOT_VERIFIED')
        }

        const priorCredit = await tx.transaction.findFirst({ where: { userId: session.sub, managerId: session.managerId, type: 'PROFIT', reference: currentTask.id }, select: { id: true } })
        if (priorCredit) throw new Error('TASK_ALREADY_CREDITED')

        /*
         * Use Decimal arithmetic for financial values.
         */
        const orderAmount =
          new Decimal(currentOrder.amount)

        const profitRate = new Decimal(currentTask.profitRate.toString())
        if (!profitRate.isFinite() || !profitRate.gt(0) || profitRate.gt(100) || profitRate.decimalPlaces() > 2) throw new Error('INVALID_PROFIT_RATE')

        const profit =
          orderAmount
            .mul(profitRate)
            .div(100)
            .toDecimalPlaces(2)

        const completedAt = new Date()

        /*
         * Atomically finalize the order.
         */
        const updatedOrder =
          await tx.order.updateMany({
            where: {
              id: currentOrder.id,
              userId: session.sub,
              managerId: session.managerId,
              status: 'RE_RENT_PENDING',
            },
            data: {
              status: 'RE_RENTED',
              profitRate,
              profit,
              rerentedAt: completedAt,
              completedAt,
            },
          })

        if (updatedOrder.count !== 1) {
          throw new Error('ORDER_ALREADY_PROCESSED')
        }

        /*
         * Wallet must belong to the authenticated user.
         */
        const walletBeforeRecord =
          await tx.wallet.findUnique({
            where: {
              userId: session.sub,
            },
            select: {
              balance: true,
              reservedBalance: true,
            },
          })

        if (!walletBeforeRecord) {
          throw new Error('WALLET_NOT_FOUND')
        }

        const balanceBefore =
          new Decimal(
            walletBeforeRecord.balance,
          )

        const balanceAfter =
          balanceBefore.add(profit)

        /*
         * Credit the wallet only after the task and order
         * have been successfully claimed.
         */
        await tx.wallet.update({
          where: {
            userId: session.sub,
          },
          data: {
            balance: {
              increment: profit,
            },
          },
        })

        const updatedTask =
          await tx.task.updateMany({
            where: {
              id: currentTask.id,
              userId: session.sub,
              managerId: session.managerId,
              status: 'IN_PROGRESS',
            },
            data: {
              status: 'COMPLETED',
              completedAt,
              profitRate,
              profitAmount: profit,
            },
          })

        if (updatedTask.count !== 1) {
          throw new Error('TASK_FINALIZATION_FAILED')
        }

        await tx.transaction.create({
          data: {
            userId: session.sub,
            managerId: session.managerId,
            type: 'PROFIT',
            amount: profit,
            reference: currentTask.id,
            balanceBefore,
            balanceAfter,
            note: `Re-Rent profit for order ${currentOrder.orderCode} at ${profitRate.toString()}%`,
          },
        })

        await tx.notification.create({
          data: {
            userId: session.sub,
            type: 'SUCCESS',
            title: 'Re-Rent completed',
            message: `Your order has been re-rented successfully. ${profitRate.toString()}% profit of ${profit.toFixed(2)} has been added to your wallet.`,
          },
        })

        /*
         * The USER initiated the settlement request.
         * Do not falsely attribute this action to the manager.
         */
        await tx.auditLog.create({
          data: {
            actorType: 'USER',
            actorId: session.sub,
            managerId: session.managerId,
            action: 'RERENT_SETTLED',
            targetType: 'ORDER',
            targetId: currentOrder.id,
            amount: profit,
            metadata: {
              orderCode: currentOrder.orderCode,
              userId: session.sub,
              managerId: session.managerId,
              orderAmount: orderAmount.toString(),
              profitRate: profitRate.toString(),
              profit: profit.toString(),
              taskId: currentTask.id,
            },
          },
        })

        return {
          taskId: currentTask.id,
          orderId: currentOrder.id,
          orderCode: currentOrder.orderCode,
          profit: profit.toFixed(2),
          profitRate: profitRate.toFixed(2),
          alreadyCompleted: false,
        }
      },
      {
        isolationLevel: 'Serializable',
      },
    )

    if (result.alreadyCompleted) {
      return NextResponse.json({
        completed: true,
        message:
          'Your order has been re-rented successfully.',
        profit: result.profit,
        profitRate: result.profitRate,
        order: {
          id: result.orderId,
          orderCode: result.orderCode,
          status: 'RE_RENTED',
        },
      })
    }

    return NextResponse.json({
      completed: true,
      message:
        'Your order has been re-rented successfully.',
      profit: result.profit,
      profitRate: result.profitRate,
      order: {
        id: result.orderId,
        orderCode: result.orderCode,
        status: 'RE_RENTED',
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
      error.message === 'TASK_NOT_FOUND'
    ) {
      return NextResponse.json(
        { error: 'Task no longer exists.' },
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
            'This task is not associated with your account.',
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
            'Your account is not currently active.',
        },
        { status: 403 },
      )
    }

    if (
      error instanceof Error &&
      error.message === 'TASK_ALREADY_PROCESSED'
    ) {
      return NextResponse.json(
        {
          error:
            'This Re-Rent task has already been processed.',
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

    if (error instanceof Error && error.message === 'PAYMENT_NOT_VERIFIED') {
      return NextResponse.json({ error: 'This booking has not been payment-confirmed.' }, { status: 409 })
    }

    if (
      error instanceof Error &&
      error.message === 'WALLET_NOT_FOUND'
    ) {
      return NextResponse.json(
        {
          error:
            'Your wallet could not be found.',
        },
        { status: 500 },
      )
    }

    if (error instanceof Error && error.message === 'INVALID_PROFIT_RATE') {
      return NextResponse.json({ error: 'This task has an invalid profit rate.' }, { status: 500 })
    }
    if (error instanceof Error && error.message === 'TASK_ALREADY_CREDITED') {
      return NextResponse.json({ error: 'This task profit has already been recorded.' }, { status: 409 })
    }

    if (
      error instanceof Error &&
      error.message ===
        'TASK_FINALIZATION_FAILED'
    ) {
      return NextResponse.json(
        {
          error:
            'Unable to finalize the Re-Rent task.',
        },
        { status: 409 },
      )
    }

    console.error(
      'RERENT_SETTLEMENT_ERROR',
      error,
    )

    return NextResponse.json(
      {
        error:
          'Unable to settle Re-Rent task.',
      },
      { status: 500 },
    )
  }
}


