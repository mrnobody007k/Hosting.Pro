import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { getClientDay } from '@/lib/client-day'
import { readJson, requireSameOrigin, handleRequestSecurityError } from '@/lib/security'

const DAY_2_RATE = new Decimal('1.20')
const DAY_3_RATE = new Decimal('1.40')
const DAY_2_TYPES = ['DAY_2_MORNING', 'DAY_2_AFTERNOON'] as const

async function latestVerifiedActiveOrder(tx: Prisma.TransactionClient, userId: string, managerId: string) {
  return tx.order.findFirst({
    where: { userId, managerId, status: 'ACTIVE', paymentStatus: 'PAID', paymentVerifiedAt: { not: null } },
    orderBy: [{ paymentVerifiedAt: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, amount: true, orderCode: true },
  })
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session || session.role !== 'USER' || !session.managerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await prisma.user.findFirst({
      where: { id: session.sub, managerId: session.managerId },
      select: { id: true, status: true, signupStatus: true, membershipStatus: true, approvedAt: true, createdAt: true, officialMemberAt: true, manager: { select: { status: true } } },
    })
    if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    if (user.status !== 'ACTIVE' || user.signupStatus !== 'APPROVED' || user.manager.status !== 'ACTIVE') return NextResponse.json({ error: 'Your account setup is still in progress.' }, { status: 403 })

    const day = getClientDay(user.approvedAt, user.createdAt)

    const verifiedOrder = await latestVerifiedActiveOrder(prisma, user.id, session.managerId!)

    const day2Tasks = await prisma.task.findMany({
      where: { userId: user.id, managerId: session.managerId!, type: { in: [...DAY_2_TYPES] } },
      orderBy: [{ assignedAt: 'asc' }, { id: 'asc' }],
      select: { id: true, type: true, title: true, description: true, dayNumber: true, profitRate: true, profitAmount: true, status: true, assignedAt: true, startedAt: true, submittedAt: true, completedAt: true, order: { select: { orderCode: true, amount: true } } },
    })
    const day2TasksByType = new Map(day2Tasks.map((task) => [task.type, task]))
    const canonicalDay2 = DAY_2_TYPES.map((type) => day2TasksByType.get(type)!).filter((task): task is typeof day2Tasks[0] => Boolean(task))
    const day2Complete = DAY_2_TYPES.every((type) => {
      const task = day2TasksByType.get(type)
      return Boolean(task && task.status === 'COMPLETED')
    })

    const day3Task = await prisma.task.findFirst({
      where: { userId: user.id, managerId: session.managerId!, type: 'DAY_3_OFFICIAL' },
      orderBy: [{ assignedAt: 'asc' }, { id: 'asc' }],
      select: { id: true, type: true, title: true, description: true, dayNumber: true, profitRate: true, profitAmount: true, status: true, assignedAt: true, startedAt: true, submittedAt: true, completedAt: true, order: { select: { orderCode: true, amount: true } } },
    })

    const visibleTasks = [...canonicalDay2, ...(day3Task ? [day3Task] : [])]

    return NextResponse.json({
      clientDay: day,
      membershipStatus: user.membershipStatus,
      officialMemberAt: user.officialMemberAt,
      day2Complete,
      rates: { day2: DAY_2_RATE.toFixed(2), day3: DAY_3_RATE.toFixed(2) },
      hasVerifiedActiveOrder: Boolean(verifiedOrder),
      tasks: visibleTasks.map((task) => ({
        ...task,
        profitRate: task.profitRate.toString(),
        profitAmount: task.profitAmount.toString(),
        principalAmount: task.order?.amount.toString() ?? null,
        order: task.order ? { orderCode: task.order.orderCode } : null,
      })),
    })
  } catch (error) {
    console.error('USER_DAILY_TASKS_ERROR', error)
    return NextResponse.json({ error: 'Unable to load daily tasks.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    requireSameOrigin(req)
    const session = await getSession()
    if (!session || session.role !== 'USER' || !session.managerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await readJson<{ taskId?: unknown }>(req, 16 * 1024)
    const taskId = String(body?.taskId || '').trim()
    if (!taskId || taskId.length > 100) return NextResponse.json({ error: 'Task ID is required.' }, { status: 400 })

    const result = await prisma.$transaction(async (tx) => {
      const task = await tx.task.findFirst({
        where: { id: taskId, userId: session.sub, managerId: session.managerId!, type: { in: [...DAY_2_TYPES, 'DAY_3_OFFICIAL'] } },
        include: { user: { select: { status: true, signupStatus: true, membershipStatus: true, managerId: true, manager: { select: { status: true } } } }, order: { select: { id: true, orderCode: true, amount: true, userId: true, managerId: true, status: true, paymentStatus: true, paymentVerifiedAt: true } } },
      })
      if (!task) throw new Error('TASK_NOT_FOUND')
      if (task.user.status !== 'ACTIVE' || task.user.signupStatus !== 'APPROVED' || task.user.managerId !== session.managerId || task.user.manager.status !== 'ACTIVE') throw new Error('USER_INACTIVE')
      if (task.status === 'COMPLETED') return { already: true, status: task.status, membershipStatus: task.user.membershipStatus }
      const retryingRejected = task.status === 'REJECTED'
      if (task.status !== 'PENDING' && task.status !== 'IN_PROGRESS' && !retryingRejected) throw new Error('TASK_UNAVAILABLE')
      if (task.type === 'DAY_3_OFFICIAL' && task.user.membershipStatus !== 'OFFICIAL_MEMBER') throw new Error('NOT_OFFICIAL')
      if (task.type !== 'DAY_3_OFFICIAL' && task.user.membershipStatus !== 'DAY_2') throw new Error('NOT_DAY_2')
      if (!task.order || task.order.userId !== session.sub || task.order.managerId !== session.managerId || task.order.status !== 'ACTIVE' || task.order.paymentStatus !== 'PAID' || !task.order.paymentVerifiedAt) throw new Error('VERIFIED_ORDER_REQUIRED')

      const sameTypeTasks = await tx.task.findMany({ where: { userId: session.sub, managerId: session.managerId!, type: task.type }, orderBy: [{ assignedAt: 'asc' }, { id: 'asc' }], select: { id: true } })
      if (sameTypeTasks[0]?.id !== task.id) throw new Error('TASK_UNAVAILABLE')

      const submittedAt = new Date()
      const submitted = await tx.task.updateMany({
        where: { id: task.id, userId: session.sub, managerId: session.managerId!, status: { in: ['PENDING', 'IN_PROGRESS', 'REJECTED'] } },
        data: { status: 'SUBMITTED', startedAt: task.startedAt || submittedAt, submittedAt },
      })
      if (submitted.count !== 1) throw new Error('TASK_UNAVAILABLE')
      await tx.notification.create({
          data: { userId: session.sub, type: 'TASK', title: retryingRejected ? 'Task retry submitted for review' : 'Task submitted for review', message: `${task.title} was submitted and is awaiting manager verification. No profit is credited until it is verified.` },
      })
      await tx.auditLog.create({
        data: { actorType: 'USER', actorId: session.sub, managerId: session.managerId!, action: retryingRejected ? 'DAILY_TASK_RETRY_SUBMITTED' : 'DAILY_TASK_SUBMITTED', targetType: 'TASK', targetId: task.id, metadata: { taskType: task.type, orderId: task.order.id, orderCode: task.order.orderCode } },
      })
      return { already: false, retryingRejected, status: 'SUBMITTED' as const, membershipStatus: task.user.membershipStatus }
    }, { isolationLevel: 'Serializable' })
    return NextResponse.json({ ok: true, completed: result.already, ...result, message: result.already ? 'This task is already completed.' : result.retryingRejected ? 'Rejected task resubmitted and awaiting manager verification.' : 'Task submitted and awaiting manager verification.' })
  } catch (error) {
    const securityResponse = handleRequestSecurityError(error)
    if (securityResponse) return securityResponse
    const code = error instanceof Error ? error.message : ''
    const map: Record<string, [string, number]> = {
      TASK_NOT_FOUND: ['Daily task not found.', 404], USER_INACTIVE: ['Your account is not active.', 403], TASK_UNAVAILABLE: ['This task is no longer available.', 409],
      NOT_OFFICIAL: ['Complete both Day 2 tasks before starting Day 3.', 409], NOT_DAY_2: ['Complete account progression before starting Day 2.', 409],
      VERIFIED_ORDER_REQUIRED: ['A verified active booking is required for this task.', 409], WALLET_NOT_FOUND: ['Your wallet could not be found.', 404], INVALID_PROFIT: ['Task profit could not be calculated.', 500],
    }
    if (map[code]) return NextResponse.json({ error: map[code][0] }, { status: map[code][1] })
    console.error('USER_DAILY_TASK_COMPLETE_ERROR', error)
    return NextResponse.json({ error: 'Unable to complete daily task.' }, { status: 500 })
  }
}
