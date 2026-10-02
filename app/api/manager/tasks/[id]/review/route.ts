import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { readJson, requireSameOrigin, handleRequestSecurityError } from '@/lib/security'
import { creditVerifiedDailyTask } from '@/lib/daily-task-settlement'
import { settleReRentTask } from '@/lib/rerent-settlement.mjs'

function isSerializationConflict(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2034')
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request)
    const session = await getSession()
    if (!session || session.role !== 'MANAGER' || !session.managerId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const manager = await prisma.manager.findUnique({ where: { id: session.managerId }, select: { id: true, status: true } })
    if (!manager || manager.status !== 'ACTIVE') return NextResponse.json({ error: 'Your manager account is not active.' }, { status: 403 })

    const { id } = await params
    if (!id || id.length > 100) return NextResponse.json({ error: 'Valid task ID is required.' }, { status: 400 })
    const body = await readJson<{ decision?: unknown; finalReturnAmount?: unknown }>(request, 16 * 1024)
    const decision = body?.decision
    if (decision !== 'APPROVE' && decision !== 'REJECT') return NextResponse.json({ error: 'Decision must be APPROVE or REJECT.' }, { status: 400 })

    if (decision === 'APPROVE') {
      const task = await prisma.task.findFirst({
        where: { id, managerId: manager.id, user: { managerId: manager.id } },
        select: { type: true },
      })
      if (task?.type === 'RE_RENT') {
        const result = await settleReRentTask(prisma, {
          taskId: id,
          managerId: manager.id,
          managerUserId: session.sub,
          finalReturnAmount: body.finalReturnAmount,
        })
        return NextResponse.json({ ok: true, ...result })
      }
    }

    for (let attempt = 1; ; attempt += 1) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          const task = await tx.task.findFirst({
            where: { id, managerId: manager.id, user: { managerId: manager.id } },
            include: {
              user: { select: { id: true, managerId: true, status: true, signupStatus: true, manager: { select: { status: true } } } },
              order: { select: { id: true, userId: true, managerId: true, orderCode: true, status: true, paymentStatus: true, paymentVerifiedAt: true } },
            },
          })
          if (!task) throw new Error('TASK_NOT_FOUND')
          if (task.user.managerId !== manager.id || task.managerId !== manager.id) throw new Error('OWNERSHIP_MISMATCH')

          if (decision === 'APPROVE' && task.status === 'COMPLETED') return { status: task.status, alreadyProcessed: true }
          if (decision === 'APPROVE' && task.status === 'VERIFIED' && task.type === 'RE_RENT') return { status: task.status, alreadyProcessed: true }
          if (decision === 'REJECT' && task.status === 'REJECTED') return { status: task.status, alreadyProcessed: true }
          if (task.status !== 'SUBMITTED') throw new Error('TASK_NOT_SUBMITTED')
          if (!task.order || task.order.userId !== task.userId || task.order.managerId !== manager.id) throw new Error('ORDER_NOT_AVAILABLE')
          if (task.user.status !== 'ACTIVE' || task.user.signupStatus !== 'APPROVED' || task.user.manager.status !== 'ACTIVE') throw new Error('USER_INACTIVE')

          if (decision === 'REJECT') {
            const rejected = await tx.task.updateMany({
              where: { id: task.id, userId: task.userId, managerId: manager.id, status: 'SUBMITTED' },
              data: { status: 'REJECTED' },
            })
            if (rejected.count !== 1) throw new Error('TASK_ALREADY_PROCESSED')
            await tx.notification.create({
              data: { userId: task.userId, type: 'TASK', title: 'Task was not approved', message: `${task.title} was reviewed and not approved. No task profit was credited.` },
            })
            await tx.auditLog.create({
              data: { actorType: 'MANAGER', actorId: session.sub, managerId: manager.id, action: 'TASK_REJECTED', targetType: 'TASK', targetId: task.id, metadata: { taskType: task.type, orderId: task.order.id } },
            })
            return { status: 'REJECTED', alreadyProcessed: false }
          }

          if (task.type === 'RE_RENT') {
            if (
              task.order.status !== 'RE_RENT_PENDING' ||
              task.order.paymentStatus !== 'PAID' ||
              !task.order.paymentVerifiedAt ||
              !task.submittedAt
            ) throw new Error('ORDER_NOT_AVAILABLE')
            const verified = await tx.task.updateMany({
              where: { id: task.id, userId: task.userId, managerId: manager.id, type: 'RE_RENT', status: 'SUBMITTED' },
              data: { status: 'VERIFIED' },
            })
            if (verified.count !== 1) throw new Error('TASK_ALREADY_PROCESSED')
            await tx.notification.create({
              data: { userId: task.userId, type: 'TASK', title: 'Re-Rent activity verified', message: `Your Re-Rent activity was verified. Settlement will occur only after the configured delay from your submission.` },
            })
            await tx.auditLog.create({
              data: { actorType: 'MANAGER', actorId: session.sub, managerId: manager.id, action: 'RERENT_TASK_VERIFIED', targetType: 'TASK', targetId: task.id, metadata: { orderId: task.order.id, orderCode: task.order.orderCode } },
            })
            return { status: 'VERIFIED', alreadyProcessed: false }
          }

          if (task.order.status !== 'ACTIVE' || task.order.paymentStatus !== 'PAID' || !task.order.paymentVerifiedAt) throw new Error('ORDER_NOT_AVAILABLE')
          const verified = await tx.task.updateMany({
            where: { id: task.id, userId: task.userId, managerId: manager.id, type: { in: ['DAY_2_MORNING', 'DAY_2_AFTERNOON', 'DAY_3_OFFICIAL'] }, status: 'SUBMITTED' },
            data: { status: 'VERIFIED' },
          })
          if (verified.count !== 1) throw new Error('TASK_ALREADY_PROCESSED')
          const credit = await creditVerifiedDailyTask(tx, { taskId: task.id, managerId: manager.id, managerUserId: session.sub })
          await tx.auditLog.create({
            data: { actorType: 'MANAGER', actorId: session.sub, managerId: manager.id, action: 'DAILY_TASK_VERIFIED', targetType: 'TASK', targetId: task.id, amount: credit.profit, metadata: { taskType: task.type, orderId: task.order.id } },
          })
          return { status: 'COMPLETED', alreadyProcessed: false, profit: credit.profit, membershipStatus: credit.membershipStatus }
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

        return NextResponse.json({ ok: true, ...result })
      } catch (error) {
        if (isSerializationConflict(error) && attempt < 3) continue
        throw error
      }
    }
  } catch (error) {
    const securityResponse = handleRequestSecurityError(error)
    if (securityResponse) return securityResponse
    const code = error instanceof Error ? error.message : ''
    const errors: Record<string, [string, number]> = {
      TASK_NOT_FOUND: ['Task not found.', 404],
      OWNERSHIP_MISMATCH: ['Task is outside your manager account.', 403],
      TASK_NOT_SUBMITTED: ['Only submitted tasks can be reviewed.', 409],
      TASK_ALREADY_PROCESSED: ['This task was already reviewed or processed.', 409],
      USER_INACTIVE: ['The task owner is not currently active.', 403],
      ORDER_NOT_AVAILABLE: ['The task booking is not eligible for verification.', 409],
      NOT_OFFICIAL: ['The user is not eligible for this Day 3 task.', 409],
      NOT_DAY_2: ['The user is not eligible for this Day 2 task.', 409],
      TASK_UNAVAILABLE: ['This task is not eligible for verification yet.', 409],
      TASK_ALREADY_CREDITED: ['This task profit has already been recorded.', 409],
      TASK_NOT_VERIFIED: ['Task verification could not be completed.', 409],
      WALLET_NOT_FOUND: ['The user wallet is unavailable.', 409],
      INVALID_PROFIT: ['Task profit could not be calculated.', 500],
      INVALID_FINAL_RETURN: ['Final return must be a positive amount with no more than two decimal places and at least the original rent.', 400],
      INVALID_REVENUE: ['Revenue could not be calculated.', 400],
      SETTLEMENT_DELAY_ACTIVE: ['The configured Re-Rent delay has not elapsed yet.', 409],
      INVALID_DELAY: ['Platform Re-Rent processing configuration is invalid.', 500],
      TIME_UNAVAILABLE: ['The submitted time is unavailable for this Re-Rent task.', 409],
      ORDER_NOT_PENDING: ['This booking is not awaiting Re-Rent settlement.', 409],
      PAYMENT_NOT_VERIFIED: ['This booking has not been payment-confirmed.', 409],
      TASK_ALREADY_SETTLED: ['This Re-Rent task already has a settlement ledger entry.', 409],
      ORDER_ALREADY_PROCESSED: ['This Re-Rent booking was already settled.', 409],
    }
    if (errors[code]) return NextResponse.json({ error: errors[code][0] }, { status: errors[code][1] })
    console.error('MANAGER_TASK_REVIEW_ERROR', error)
    return NextResponse.json({ error: 'Unable to review task.' }, { status: 500 })
  }
}
