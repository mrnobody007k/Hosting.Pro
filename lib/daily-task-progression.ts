import { Prisma } from '@prisma/client'
import Decimal from 'decimal.js'
import { getClientDay } from '@/lib/client-day'

const DAY_2_RATE = new Decimal('1.20')
const DAY_3_RATE = new Decimal('1.40')
const DAY_2_TYPES = ['DAY_2_MORNING', 'DAY_2_AFTERNOON'] as const

export async function syncDailyTaskProgress(tx: Prisma.TransactionClient, userId: string, managerId: string, now = new Date()) {
  const user = await tx.user.findFirst({
    where: { id: userId, managerId },
    select: { id: true, status: true, signupStatus: true, membershipStatus: true, approvedAt: true, createdAt: true, manager: { select: { status: true } } },
  })
  if (!user) throw new Error('USER_NOT_FOUND')
  if (user.status !== 'ACTIVE' || user.signupStatus !== 'APPROVED' || user.manager.status !== 'ACTIVE') throw new Error('USER_INACTIVE')

  const day = getClientDay(user.approvedAt, user.createdAt, now)
  const verifiedOrder = await tx.order.findFirst({
    where: { userId, managerId, status: 'ACTIVE', paymentStatus: 'PAID', paymentVerifiedAt: { not: null } },
    orderBy: [{ paymentVerifiedAt: 'desc' }, { createdAt: 'desc' }],
    select: { id: true },
  })
  const existingDay2 = await tx.task.findMany({
    where: { userId, managerId, type: { in: [...DAY_2_TYPES] } },
    orderBy: [{ assignedAt: 'asc' }, { id: 'asc' }],
    select: { id: true, type: true, status: true, orderId: true },
  })
  const day2Complete = DAY_2_TYPES.every((type) => existingDay2.some((task) => task.type === type && task.status === 'COMPLETED'))

  if (day >= 2 && verifiedOrder && !day2Complete) {
    for (const type of DAY_2_TYPES) {
      const existing = existingDay2.find((task) => task.type === type)
      if (!existing) {
        const morning = type === 'DAY_2_MORNING'
        await tx.task.create({ data: {
          userId, managerId, orderId: verifiedOrder.id, type,
          title: morning ? 'Day 2 — Morning Task' : 'Day 2 — Afternoon Task',
          description: morning ? 'Complete your morning activity.' : 'Complete your afternoon activity.',
          dayNumber: 2, profitRate: DAY_2_RATE.toFixed(2), profitAmount: 0,
        } })
      } else if (!existing.orderId && existing.status !== 'COMPLETED') {
        await tx.task.updateMany({
          where: { id: existing.id, userId, managerId, status: { in: ['PENDING', 'IN_PROGRESS'] }, orderId: null },
          data: { orderId: verifiedOrder.id, profitRate: DAY_2_RATE.toFixed(2) },
        })
      }
    }
    if (user.membershipStatus === 'DAY_1') await tx.user.update({ where: { id: user.id }, data: { membershipStatus: 'DAY_2' } })
  }

  const day2Tasks = await tx.task.findMany({
    where: { userId, managerId, type: { in: [...DAY_2_TYPES] } },
    orderBy: [{ assignedAt: 'asc' }, { id: 'asc' }],
    select: { id: true, type: true, status: true },
  })
  const completedDay2 = day2Tasks.filter((task) => task.status === 'COMPLETED')
  const day2Credits = await tx.transaction.findMany({
    where: { userId, managerId, type: 'PROFIT', reference: { in: completedDay2.map((task) => task.id) } },
    select: { reference: true },
  })
  const creditedTaskIds = new Set(day2Credits.map((credit) => credit.reference))
  const bothComplete = DAY_2_TYPES.every((type) => {
    const task = day2Tasks.find((item) => item.type === type && item.status === 'COMPLETED')
    return Boolean(task && creditedTaskIds.has(task.id))
  })
  let membershipStatus = user.membershipStatus
  if (bothComplete && membershipStatus !== 'OFFICIAL_MEMBER') {
    const promoted = await tx.user.updateMany({ where: { id: userId, managerId, membershipStatus: { not: 'OFFICIAL_MEMBER' } }, data: { membershipStatus: 'OFFICIAL_MEMBER', officialMemberAt: now } })
    if (promoted.count === 1) {
      membershipStatus = 'OFFICIAL_MEMBER'
      await tx.notification.create({ data: { userId, type: 'SUCCESS', title: 'Official membership unlocked', message: 'Both required Day 2 tasks are complete. Your Day 3 membership is active.' } })
    } else {
      const fresh = await tx.user.findFirst({ where: { id: userId, managerId }, select: { membershipStatus: true } })
      membershipStatus = fresh?.membershipStatus ?? membershipStatus
    }
  }

  if (day >= 3 && bothComplete && membershipStatus === 'OFFICIAL_MEMBER' && verifiedOrder) {
    const existingDay3 = await tx.task.findFirst({ where: { userId, managerId, type: 'DAY_3_OFFICIAL' }, orderBy: [{ assignedAt: 'asc' }, { id: 'asc' }], select: { id: true, orderId: true, status: true } })
    if (!existingDay3) {
      await tx.task.create({ data: { userId, managerId, orderId: verifiedOrder.id, type: 'DAY_3_OFFICIAL', title: 'Day 3 — Official Member Task', description: 'Complete your official-member Day 3 activity.', dayNumber: 3, profitRate: DAY_3_RATE.toFixed(2), profitAmount: 0 } })
      await tx.notification.create({ data: { userId, type: 'TASK', title: 'Day 3 task available', message: `Your official-member Day 3 task is available at ${DAY_3_RATE.toFixed(2)}%.` } })
    } else if (!existingDay3.orderId && existingDay3.status !== 'COMPLETED') {
      await tx.task.updateMany({ where: { id: existingDay3.id, userId, managerId, status: { in: ['PENDING', 'IN_PROGRESS'] }, orderId: null }, data: { orderId: verifiedOrder.id, profitRate: DAY_3_RATE.toFixed(2) } })
    }
  }
  return { day, membershipStatus, day2Complete: bothComplete, hasVerifiedActiveOrder: Boolean(verifiedOrder) }
}
