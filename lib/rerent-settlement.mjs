import { Decimal } from 'decimal.js'

const MAX_SETTLEMENT_RETRIES = 3
const MAX_DECIMAL_18_2 = new Decimal('9999999999999999.99')

export function parseFinalReturnAmount(value) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(value.trim())) return null
  const amount = new Decimal(value.trim())
  return amount.isFinite() && amount.gt(0) && amount.lte(MAX_DECIMAL_18_2) ? amount : null
}

function isSerializationConflict(error) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2034')
}

/** Manager-only, idempotent Re-Rent return settlement. */
export async function settleReRentTask(prisma, { taskId, managerId, managerUserId, finalReturnAmount, now = new Date() }) {
  const returnAmount = parseFinalReturnAmount(finalReturnAmount)
  if (!returnAmount) throw new Error('INVALID_FINAL_RETURN')

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const task = await tx.task.findFirst({
          where: { id: taskId, managerId, type: 'RE_RENT', user: { managerId } },
          include: {
            order: true,
            user: { select: { id: true, managerId: true, status: true, signupStatus: true, manager: { select: { status: true } } } },
          },
        })

        if (!task || !task.order) throw new Error('TASK_NOT_FOUND')
        if (task.user.managerId !== managerId || task.order.managerId !== managerId || task.order.userId !== task.userId) throw new Error('OWNERSHIP_MISMATCH')
        if (task.user.status !== 'ACTIVE' || task.user.signupStatus !== 'APPROVED' || task.user.manager.status !== 'ACTIVE') throw new Error('USER_INACTIVE')

        if (task.status === 'COMPLETED' && task.order.status === 'RE_RENTED') {
          return {
            status: 'COMPLETED', taskId: task.id, orderId: task.order.id, orderCode: task.order.orderCode,
            finalReturnAmount: task.order.finalReturnAmount?.toString() ?? null,
            revenue: task.order.profit.toString(), alreadyCompleted: true,
          }
        }
        if (!['SUBMITTED', 'VERIFIED'].includes(task.status)) throw new Error('TASK_NOT_SUBMITTED')
        if (task.order.status !== 'RE_RENT_PENDING') throw new Error('ORDER_NOT_PENDING')
        if (task.order.paymentStatus !== 'PAID' || !task.order.paymentVerifiedAt) throw new Error('PAYMENT_NOT_VERIFIED')
        if (!task.submittedAt) throw new Error('TIME_UNAVAILABLE')

        const setting = await tx.platformSetting.findFirst({ select: { rerentDelaySeconds: true } })
        const delaySeconds = Number(setting?.rerentDelaySeconds ?? 90)
        if (!Number.isInteger(delaySeconds) || delaySeconds < 0 || delaySeconds > 86_400) throw new Error('INVALID_DELAY')
        const remainingSeconds = Math.ceil(delaySeconds - (now.getTime() - task.submittedAt.getTime()) / 1000)
        if (remainingSeconds > 0) throw new Error('SETTLEMENT_DELAY_ACTIVE')

        const principal = new Decimal(task.order.amount.toString())
        if (!principal.isFinite() || !principal.gt(0) || principal.decimalPlaces() > 2 || !returnAmount.gte(principal)) {
          throw new Error('INVALID_FINAL_RETURN')
        }
        const revenue = returnAmount.minus(principal).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        if (!revenue.isFinite() || revenue.isNegative()) throw new Error('INVALID_REVENUE')

        const existingSettlement = await tx.transaction.findFirst({
          where: { userId: task.userId, managerId, type: 'RERENT_SETTLEMENT', reference: task.id },
          select: { id: true },
        })
        if (existingSettlement) throw new Error('TASK_ALREADY_SETTLED')

        const wallet = await tx.wallet.findUnique({ where: { userId: task.userId }, select: { balance: true } })
        if (!wallet) throw new Error('WALLET_NOT_FOUND')
        const balanceBefore = new Decimal(wallet.balance.toString())
        const balanceAfter = balanceBefore.add(returnAmount)
        const completedAt = now

        const claimedOrder = await tx.order.updateMany({
          where: { id: task.order.id, userId: task.userId, managerId, status: 'RE_RENT_PENDING', finalReturnAmount: null },
          data: { status: 'RE_RENTED', finalReturnAmount: returnAmount, profit: revenue, rerentedAt: completedAt, completedAt },
        })
        if (claimedOrder.count !== 1) throw new Error('ORDER_ALREADY_PROCESSED')

        const completedTask = await tx.task.updateMany({
          where: { id: task.id, userId: task.userId, managerId, type: 'RE_RENT', status: { in: ['SUBMITTED', 'VERIFIED'] } },
          data: { status: 'COMPLETED', completedAt, profitAmount: revenue },
        })
        if (completedTask.count !== 1) throw new Error('TASK_ALREADY_PROCESSED')

        await tx.wallet.update({ where: { userId: task.userId }, data: { balance: { increment: returnAmount } } })
        await tx.transaction.create({
          data: {
            userId: task.userId, managerId, type: 'RERENT_SETTLEMENT', amount: returnAmount,
            reference: task.id, balanceBefore, balanceAfter,
            note: `Manager-approved Re-Rent return for order ${task.order.orderCode}; principal ${principal.toFixed(2)}; revenue ${revenue.toFixed(2)}`,
          },
        })
        await tx.notification.create({
          data: {
            userId: task.userId, type: 'SUCCESS', title: 'Re-Rent settlement approved',
            message: `Your final return of ₹${returnAmount.toFixed(2)} was credited. Original rent: ₹${principal.toFixed(2)}; revenue: ₹${revenue.toFixed(2)}.`,
          },
        })
        await tx.auditLog.create({
          data: {
            actorType: 'MANAGER', actorId: managerUserId, managerId, action: 'RERENT_SETTLED',
            targetType: 'ORDER', targetId: task.order.id, amount: returnAmount,
            metadata: {
              taskId: task.id, orderCode: task.order.orderCode, userId: task.userId,
              principal: principal.toFixed(2), finalReturnAmount: returnAmount.toFixed(2), revenue: revenue.toFixed(2),
            },
          },
        })

        return {
          status: 'COMPLETED', taskId: task.id, orderId: task.order.id, orderCode: task.order.orderCode,
          finalReturnAmount: returnAmount.toFixed(2), revenue: revenue.toFixed(2), alreadyCompleted: false,
        }
      }, { isolationLevel: 'Serializable' })
    } catch (error) {
      if (isSerializationConflict(error) && attempt < MAX_SETTLEMENT_RETRIES) continue
      throw error
    }
  }
}
