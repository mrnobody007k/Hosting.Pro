import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { settleReRentTask } from '@/lib/rerent-settlement.mjs'
import {
  readJson,
  requireSameOrigin,
  handleRequestSecurityError,
} from '@/lib/security'

const LEGACY_DIRECT_RERENT_TITLE = 'Re-Rent Request'

const messages: Record<string, { error: string; status: number }> = {
  TASK_NOT_FOUND: { error: 'Task no longer exists.', status: 404 },
  OWNERSHIP_MISMATCH: { error: 'This task is not associated with your account.', status: 403 },
  USER_INACTIVE: { error: 'Your account is not currently active.', status: 403 },
  TASK_NOT_SUBMITTED: { error: 'The Re-Rent request has not been submitted yet.', status: 400 },
  TASK_NOT_VERIFIED: { error: 'This Re-Rent activity is awaiting manager verification.', status: 409 },
  ORDER_NOT_PENDING: { error: 'This order is not waiting for Re-Rent settlement.', status: 400 },
  TIME_UNAVAILABLE: { error: 'Re-Rent processing time is not available yet.', status: 400 },
  INVALID_DELAY: { error: 'Platform Re-Rent processing configuration is invalid.', status: 500 },
  TASK_ALREADY_PROCESSED: { error: 'This Re-Rent task has already been processed.', status: 409 },
  ORDER_ALREADY_PROCESSED: { error: 'This order has already been processed.', status: 409 },
  PAYMENT_NOT_VERIFIED: { error: 'This booking has not been payment-confirmed.', status: 409 },
  TASK_ALREADY_CREDITED: { error: 'This task profit has already been recorded.', status: 409 },
  WALLET_NOT_FOUND: { error: 'Your wallet could not be found.', status: 500 },
  INVALID_PROFIT_RATE: { error: 'This task has an invalid profit rate.', status: 500 },
  INVALID_PROFIT: { error: 'This task has an invalid profit amount.', status: 500 },
  TASK_FINALIZATION_FAILED: { error: 'Unable to finalize the Re-Rent task.', status: 409 },
  MANAGER_ASSIGNMENT_REQUIRED: { error: 'This Re-Rent activity must be assigned by your manager.', status: 409 },
}

export async function POST(req: Request) {
  try {
    requireSameOrigin(req)
    const session = await getSession()
    if (!session || session.role !== 'USER' || !session.managerId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const body = await readJson<{ taskId?: unknown }>(req)
    const taskId = String(body.taskId || '').trim()
    if (!taskId || taskId.length > 100) {
      return NextResponse.json({ error: 'Valid task ID is required.' }, { status: 400 })
    }

    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        userId: session.sub,
        managerId: session.managerId,
        type: 'RE_RENT',
      },
      select: { dayNumber: true, status: true, title: true },
    })
    if (!task) {
      return NextResponse.json({ error: messages.TASK_NOT_FOUND.error }, { status: messages.TASK_NOT_FOUND.status })
    }

    // Existing user-originated requests are grandfathered so the policy
    // change does not strand them; all new submissions require a manager-
    // created task (dayNumber 1). Completed legacy tasks stay idempotent.
    const managerAssigned = task.dayNumber === 1
    const legacyRequest = task.dayNumber === 0 && task.title === LEGACY_DIRECT_RERENT_TITLE && ['SUBMITTED', 'VERIFIED', 'COMPLETED'].includes(task.status)
    if (!managerAssigned && !legacyRequest) {
      return NextResponse.json(
        { error: messages.MANAGER_ASSIGNMENT_REQUIRED.error },
        { status: messages.MANAGER_ASSIGNMENT_REQUIRED.status },
      )
    }

    const result = await settleReRentTask(prisma, {
      taskId,
      userId: session.sub,
      managerId: session.managerId,
      source: 'USER',
    })

    if (result.status === 'PROCESSING') {
      return NextResponse.json({
        completed: false,
        processing: true,
        remainingSeconds: result.remainingSeconds,
        message: `Your Re-Rent request is processing. Please wait ${result.remainingSeconds} seconds.`,
      })
    }

    return NextResponse.json({
      completed: true,
      message: 'Your order has been re-rented successfully.',
      profit: result.profit,
      profitRate: result.profitRate,
      order: { id: result.orderId, orderCode: result.orderCode, status: 'RE_RENTED' },
    })
  } catch (error) {
    const securityResponse = handleRequestSecurityError(error)
    if (securityResponse) return securityResponse

    if (error instanceof Error && messages[error.message]) {
      const mapped = messages[error.message]
      return NextResponse.json({ error: mapped.error }, { status: mapped.status })
    }

    console.error('RERENT_SETTLEMENT_ERROR', error)
    return NextResponse.json({ error: 'Unable to settle Re-Rent task.' }, { status: 500 })
  }
}
