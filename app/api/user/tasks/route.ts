import { NextResponse } from 'next/server'
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

    const taskId = String(
      body.taskId || '',
    ).trim()

    if (
      !taskId ||
      taskId.length > 100
    ) {
      return NextResponse.json(
        {
          error:
            'Valid task ID is required.',
        },
        { status: 400 },
      )
    }

    /*
     * Full ownership chain:
     *
     * USER session
     *   -> TASK.userId
     *   -> TASK.managerId
     *   -> ORDER.userId
     *   -> ORDER.managerId
     */
    const task =
      await prisma.task.findFirst({
        where: {
          id: taskId,
          userId: session.sub,
          managerId: session.managerId,
          type: 'RE_RENT',
        },
        include: {
          order: {
            select: {
              id: true,
              userId: true,
              managerId: true,
              orderCode: true,
              status: true,
              rerentRequestedAt: true,
            },
          },
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

    if (
      !task ||
      !task.order
    ) {
      return NextResponse.json(
        {
          error:
            'Re-Rent task not found.',
        },
        { status: 404 },
      )
    }

    if (
      task.user.managerId !==
        session.managerId ||
      task.order.managerId !==
        session.managerId ||
      task.order.userId !==
        session.sub
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
      task.user.status !== 'ACTIVE' ||
      task.user.signupStatus !== 'APPROVED' ||
      task.user.manager.status !== 'ACTIVE'
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
      task.status !== 'PENDING' &&
      task.status !== 'IN_PROGRESS'
    ) {
      return NextResponse.json(
        {
          error:
            'This task is no longer available.',
        },
        { status: 400 },
      )
    }

    const submittedAt =
      new Date()

    const updated =
      await prisma.$transaction(
        async (tx) => {
          /*
           * Re-check complete ownership chain
           * inside the transaction.
           */
          const current =
            await tx.task.findFirst({
              where: {
                id: task.id,
                userId: session.sub,
                managerId:
                  session.managerId,
                type: 'RE_RENT',
              },
              include: {
                order: {
                  select: {
                    id: true,
                    userId: true,
                    managerId: true,
                    orderCode: true,
                    status: true,
                    rerentRequestedAt:
                      true,
                  },
                },
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

          if (
            !current ||
            !current.order
          ) {
            throw new Error(
              'TASK_NOT_FOUND',
            )
          }

          if (
            current.user.managerId !==
              session.managerId ||
            current.order.managerId !==
              session.managerId ||
            current.order.userId !==
              session.sub
          ) {
            throw new Error(
              'OWNERSHIP_MISMATCH',
            )
          }

          if (
            current.user.status !== 'ACTIVE' ||
            current.user.signupStatus !== 'APPROVED' ||
            current.user.manager.status !== 'ACTIVE'
          ) {
            throw new Error(
              'USER_INACTIVE',
            )
          }

          if (
            current.status !==
              'PENDING' &&
            current.status !==
              'IN_PROGRESS'
          ) {
            throw new Error(
              'TASK_ALREADY_SUBMITTED',
            )
          }

          /*
           * Order must still be active before the
           * Re-Rent request can move it to pending.
           */
          if (
            current.order.status !==
            'ACTIVE'
          ) {
            throw new Error(
              'ORDER_NOT_ACTIVE',
            )
          }

          /*
           * Atomic task claim.
           *
           * Prevents two simultaneous requests from
           * both submitting the same task.
           */
          const claimed =
            await tx.task.updateMany({
              where: {
                id: current.id,
                userId: session.sub,
                managerId:
                  session.managerId,
                status: {
                  in: [
                    'PENDING',
                    'IN_PROGRESS',
                  ],
                },
              },
              data: {
                status: 'SUBMITTED',
                submittedAt,
              },
            })

          if (
            claimed.count !== 1
          ) {
            throw new Error(
              'TASK_ALREADY_SUBMITTED',
            )
          }

          /*
           * Atomically move only this user's,
           * manager-owned order to Re-Rent pending.
           */
          const orderChanged =
            await tx.order.updateMany({
              where: {
                id: current.order.id,
                userId: session.sub,
                managerId:
                  session.managerId,
                status: 'ACTIVE',
              },
              data: {
                status:
                  'RE_RENT_PENDING',
                rerentRequestedAt:
                  submittedAt,
              },
            })

          if (
            orderChanged.count !== 1
          ) {
            throw new Error(
              'ORDER_ALREADY_PROCESSED',
            )
          }

          await tx.notification.create({
            data: {
              userId: session.sub,
              type: 'TASK',
              title:
                'Re-Rent request submitted',
              message:
                `Your Re-Rent request for order ${current.order.orderCode} has been received. Processing will complete automatically.`,
            },
          })

          await tx.auditLog.create({
            data: {
              actorType: 'USER',
              actorId: session.sub,
              managerId:
                session.managerId,
              action:
                'RERENT_REQUEST_SUBMITTED',
              targetType: 'TASK',
              targetId: current.id,
              metadata: {
                orderCode:
                  current.order.orderCode,
                orderId:
                  current.order.id,
                userId:
                  session.sub,
                managerId:
                  session.managerId,
              },
            },
          })

          return {
            id: current.id,
            status: 'SUBMITTED' as const,
            submittedAt,
          }
        },
        {
          isolationLevel:
            'Serializable',
        },
      )

    const setting =
      await prisma.platformSetting.findFirst({
        select: {
          rerentDelaySeconds: true,
        },
      })

    const processingSeconds =
      Number(
        setting?.rerentDelaySeconds ??
          90,
      )

    return NextResponse.json({
      message:
        'Re-Rent request submitted successfully.',
      task: updated,
      processingSeconds:
        Number.isFinite(
          processingSeconds,
        ) &&
        processingSeconds >= 0
          ? processingSeconds
          : 90,
    })
  } catch (error) {
    const securityResponse =
      handleRequestSecurityError(
        error,
      )

    if (securityResponse) {
      return securityResponse
    }

    if (
      error instanceof Error &&
      error.message ===
        'TASK_NOT_FOUND'
    ) {
      return NextResponse.json(
        {
          error:
            'Task no longer exists.',
        },
        { status: 404 },
      )
    }

    if (
      error instanceof Error &&
      error.message ===
        'OWNERSHIP_MISMATCH'
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
      error.message ===
        'USER_INACTIVE'
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
      error.message ===
        'TASK_ALREADY_SUBMITTED'
    ) {
      return NextResponse.json(
        {
          error:
            'Task has already been submitted.',
        },
        { status: 409 },
      )
    }

    if (
      error instanceof Error &&
      error.message ===
        'ORDER_NOT_ACTIVE'
    ) {
      return NextResponse.json(
        {
          error:
            'This order is not currently available for Re-Rent.',
        },
        { status: 409 },
      )
    }

    if (
      error instanceof Error &&
      error.message ===
        'ORDER_ALREADY_PROCESSED'
    ) {
      return NextResponse.json(
        {
          error:
            'This order has already been processed.',
        },
        { status: 409 },
      )
    }

    console.error(
      'USER_RERENT_SUBMIT_ERROR',
      error,
    )

    return NextResponse.json(
      {
        error:
          'Unable to submit Re-Rent request.',
      },
      { status: 500 },
    )
  }
}
