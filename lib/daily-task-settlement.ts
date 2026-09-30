import { Prisma } from '@prisma/client'
import Decimal from 'decimal.js'

const DAY_2_RATE = new Decimal('1.20')
const DAY_3_RATE = new Decimal('1.40')
const DAY_2_TYPES = ['DAY_2_MORNING', 'DAY_2_AFTERNOON'] as const

export async function creditVerifiedDailyTask(
  tx: Prisma.TransactionClient,
  input: { taskId: string; managerId: string; managerUserId: string },
) {
  const task = await tx.task.findFirst({
    where: {
      id: input.taskId,
      managerId: input.managerId,
      type: { in: [...DAY_2_TYPES, 'DAY_3_OFFICIAL'] },
      status: 'VERIFIED',
    },
    include: {
      user: { select: { id: true, managerId: true, status: true, signupStatus: true, membershipStatus: true, manager: { select: { status: true } } } },
      order: { select: { id: true, userId: true, managerId: true, orderCode: true, amount: true, status: true, paymentStatus: true, paymentVerifiedAt: true } },
    },
  })
  if (!task) throw new Error('TASK_NOT_VERIFIED')
  if (
    task.user.managerId !== input.managerId ||
    task.managerId !== input.managerId ||
    task.user.status !== 'ACTIVE' ||
    task.user.signupStatus !== 'APPROVED' ||
    task.user.manager.status !== 'ACTIVE'
  ) throw new Error('USER_INACTIVE')

  if (task.type === 'DAY_3_OFFICIAL' && task.user.membershipStatus !== 'OFFICIAL_MEMBER') throw new Error('NOT_OFFICIAL')
  if (task.type !== 'DAY_3_OFFICIAL' && task.user.membershipStatus !== 'DAY_2') throw new Error('NOT_DAY_2')
  if (
    !task.order ||
    task.order.userId !== task.userId ||
    task.order.managerId !== input.managerId ||
    task.order.status !== 'ACTIVE' ||
    task.order.paymentStatus !== 'PAID' ||
    !task.order.paymentVerifiedAt
  ) throw new Error('VERIFIED_ORDER_REQUIRED')

  const sameTypeTasks = await tx.task.findMany({
    where: { userId: task.userId, managerId: input.managerId, type: task.type },
    orderBy: [{ assignedAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  })
  if (sameTypeTasks[0]?.id !== task.id) throw new Error('TASK_UNAVAILABLE')

  const existingCredit = await tx.transaction.findFirst({
    where: { userId: task.userId, managerId: input.managerId, type: 'PROFIT', reference: task.id },
    select: { id: true },
  })
  if (existingCredit) throw new Error('TASK_ALREADY_CREDITED')

  const rate = task.type === 'DAY_3_OFFICIAL' ? DAY_3_RATE : DAY_2_RATE
  const principal = new Decimal(task.order.amount.toString())
  const profit = principal.mul(rate).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  if (!principal.isFinite() || principal.isNegative() || !profit.isFinite() || profit.isNegative()) throw new Error('INVALID_PROFIT')

  const wallet = await tx.wallet.findUnique({ where: { userId: task.userId }, select: { balance: true } })
  if (!wallet) throw new Error('WALLET_NOT_FOUND')
  const balanceBefore = new Decimal(wallet.balance.toString())
  const completedAt = new Date()
  const completed = await tx.task.updateMany({
    where: { id: task.id, userId: task.userId, managerId: input.managerId, type: task.type, status: 'VERIFIED' },
    data: { status: 'COMPLETED', completedAt, profitRate: rate.toFixed(2), profitAmount: profit },
  })
  if (completed.count !== 1) throw new Error('TASK_ALREADY_PROCESSED')

  await tx.wallet.update({ where: { userId: task.userId }, data: { balance: { increment: profit } } })
  await tx.transaction.create({
    data: {
      userId: task.userId,
      managerId: input.managerId,
      type: 'PROFIT',
      amount: profit,
      balanceBefore,
      balanceAfter: balanceBefore.add(profit),
      reference: task.id,
      note: `${task.title} profit for order ${task.order.orderCode} at ${rate.toFixed(2)}%`,
    },
  })
  await tx.notification.create({
    data: { userId: task.userId, type: 'WALLET', title: 'Task verified and completed', message: `Your ${task.title} activity was verified. INR ${profit.toFixed(2)} profit was added to your wallet.` },
  })
  await tx.auditLog.create({
    data: {
      actorType: 'MANAGER',
      actorId: input.managerUserId,
      managerId: input.managerId,
      action: 'DAILY_TASK_PROFIT_CREDITED',
      targetType: 'TASK',
      targetId: task.id,
      amount: profit,
      metadata: { taskType: task.type, orderId: task.order.id, orderCode: task.order.orderCode, profitRate: rate.toFixed(2), principal: principal.toString(), profit: profit.toFixed(2) },
    },
  })

  let membershipStatus = task.user.membershipStatus
  if (task.type !== 'DAY_3_OFFICIAL') {
    const day2Tasks = await tx.task.findMany({
      where: { userId: task.userId, managerId: input.managerId, type: { in: [...DAY_2_TYPES] } },
      orderBy: [{ assignedAt: 'asc' }, { id: 'asc' }],
      select: { id: true, type: true, status: true },
    })
    const completedTypes = DAY_2_TYPES.filter((type) => day2Tasks.find((item) => item.type === type && item.status === 'COMPLETED'))
    const completedIds = day2Tasks.filter((item) => item.status === 'COMPLETED').map((item) => item.id)
    const verifiedCredits = await tx.transaction.findMany({
      where: { userId: task.userId, managerId: input.managerId, type: 'PROFIT', reference: { in: completedIds } },
      select: { reference: true },
    })
    const creditedIds = new Set(verifiedCredits.map((row) => row.reference))
    const bothCredited = DAY_2_TYPES.every((type) => {
      const dayTask = day2Tasks.find((item) => item.type === type && item.status === 'COMPLETED')
      return Boolean(dayTask && creditedIds.has(dayTask.id))
    })
    if (completedTypes.length === DAY_2_TYPES.length && bothCredited && membershipStatus === 'DAY_2') {
      const promoted = await tx.user.updateMany({
        where: { id: task.userId, managerId: input.managerId, signupStatus: 'APPROVED', membershipStatus: 'DAY_2' },
        data: { membershipStatus: 'OFFICIAL_MEMBER', officialMemberAt: completedAt },
      })
      if (promoted.count === 1) {
        membershipStatus = 'OFFICIAL_MEMBER'
        await tx.notification.create({
          data: { userId: task.userId, type: 'SUCCESS', title: 'Official membership unlocked', message: 'Both required Day 2 tasks were verified and credited. Your Day 3 membership is active.' },
        })
      }
    }
  }

  return { profit: profit.toFixed(2), membershipStatus }
}
