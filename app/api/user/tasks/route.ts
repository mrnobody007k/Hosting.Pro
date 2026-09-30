import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import {
  readJson,
  requireSameOrigin,
  handleRequestSecurityError,
  isValidHttpsUrl,
} from '@/lib/security'

const LEGACY_DIRECT_RERENT_TITLE = 'Re-Rent Request'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'USER' || !session.managerId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    const user = await prisma.user.findFirst({
      where: { id: session.sub, managerId: session.managerId, status: 'ACTIVE', signupStatus: 'APPROVED', manager: { status: 'ACTIVE' } },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: 'Your account is not available.' }, { status: 403 })
    const cursor = new URL(request.url).searchParams.get('cursor')
    if (cursor && (cursor.length > 100 || !(await prisma.task.findFirst({ where: { id: cursor, userId: user.id, managerId: session.managerId, type: 'RE_RENT' }, select: { id: true } })))) {
      return NextResponse.json({ error: 'Invalid task page cursor.' }, { status: 400 })
    }
    const tasks = await prisma.task.findMany({
      where: { userId: user.id, managerId: session.managerId, type: 'RE_RENT' },
      orderBy: [{ assignedAt: 'desc' }, { id: 'desc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: 50,
      select: {
        id: true, type: true, title: true, description: true, propertyUrl: true, dayNumber: true,
        profitRate: true, profitAmount: true, status: true, assignedAt: true, startedAt: true,
        submittedAt: true, completedAt: true, createdAt: true,
        order: { select: { id: true, orderCode: true, status: true, rerentedAt: true, property: { select: { id: true, title: true, location: true, imageUrl: true } } } },
      },
    })
    return NextResponse.json({
      tasks: tasks.map((task) => ({ ...task, propertyUrl: task.propertyUrl && isValidHttpsUrl(task.propertyUrl) ? task.propertyUrl : null, profitRate: task.profitRate.toString(), profitAmount: task.profitAmount.toString() })),
      nextCursor: tasks.length === 50 ? tasks[tasks.length - 1].id : null,
    })
  } catch (error) {
    console.error('USER_RERENT_TASKS_GET_ERROR', error)
    return NextResponse.json({ error: 'Unable to load your assigned activities.' }, { status: 500 })
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

    const managerAssignedTask = task.dayNumber === 1
    const legacyExistingRequest = task.dayNumber === 0 && task.title === LEGACY_DIRECT_RERENT_TITLE
    if (
      (!managerAssignedTask && !legacyExistingRequest) ||
      task.order.status !== 'RE_RENT_PENDING' ||
      !task.order.rerentRequestedAt
    ) {
      return NextResponse.json(
        { error: 'New Re-Rent activities must be assigned by your manager.' },
        { status: 409 },
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
      task.status !== 'IN_PROGRESS' &&
      task.status !== 'REJECTED'
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

          const managerAssignedTask = current.dayNumber === 1
          const legacyExistingRequest = current.dayNumber === 0 && current.title === LEGACY_DIRECT_RERENT_TITLE
          if (
            (!managerAssignedTask && !legacyExistingRequest) ||
            current.order.status !== 'RE_RENT_PENDING' ||
            !current.order.rerentRequestedAt
          ) {
            throw new Error('MANAGER_ASSIGNMENT_REQUIRED')
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
              'IN_PROGRESS' &&
            current.status !==
              'REJECTED'
          ) {
            throw new Error(
              'TASK_ALREADY_SUBMITTED',
            )
          }

          if (current.order.status !== 'RE_RENT_PENDING') {
            throw new Error('ORDER_NOT_ACTIVE')
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
                    'REJECTED',
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
                status: 'RE_RENT_PENDING',
                rerentRequestedAt: { not: null },
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
              title: current.status === 'REJECTED' ? 'Re-Rent activity retry submitted' : current.dayNumber === 0 ? 'Existing Re-Rent request submitted' : 'Re-Rent activity submitted',
              message:
                `${current.dayNumber === 0 ? 'Your existing Re-Rent request' : 'Your manager-assigned Re-Rent activity'} for order ${current.order.orderCode} was submitted. No profit is credited unless the manager approves it. Settlement will complete automatically after the configured processing delay.`,
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
            legacy: current.dayNumber === 0,
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
        updated.legacy
          ? 'Your existing Re-Rent request was submitted and will settle after the configured processing delay.'
          : 'Manager-assigned Re-Rent activity submitted successfully.',
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

    if (error instanceof Error && error.message === 'MANAGER_ASSIGNMENT_REQUIRED') {
      return NextResponse.json(
        { error: 'New Re-Rent activities must be assigned by your manager.' },
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
