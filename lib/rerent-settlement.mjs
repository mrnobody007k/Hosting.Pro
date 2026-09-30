import { Decimal } from 'decimal.js'

const MAX_SETTLEMENT_RETRIES = 3

function isSerializationConflict(error) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2034')
}

/**
 * Idempotently settle a verified Re-Rent task. Both the authenticated API
 * and the standalone worker call this function so delay, ownership, profit,
 * and wallet rules cannot drift between execution paths.
 */
export async function settleReRentTask(prisma, { taskId, userId, managerId, source = 'USER' }) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const task = await tx.task.findFirst({
          where: { id: taskId, userId, managerId, type: 'RE_RENT' },
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

        if (!task || !task.order) throw new Error('TASK_NOT_FOUND')
        if (task.user.managerId !== managerId || task.order.managerId !== managerId || task.order.userId !== userId) {
          throw new Error('OWNERSHIP_MISMATCH')
        }
        if (task.user.status !== 'ACTIVE' || task.user.signupStatus !== 'APPROVED' || task.user.manager.status !== 'ACTIVE') {
          throw new Error('USER_INACTIVE')
        }

        if (task.status === 'COMPLETED' && task.order.status === 'RE_RENTED') {
          return {
            status: 'COMPLETED',
            taskId: task.id,
            orderId: task.order.id,
            orderCode: task.order.orderCode,
            profit: task.profitAmount.toString(),
            profitRate: task.profitRate.toString(),
            alreadyCompleted: true,
          }
        }
        if (task.status === 'SUBMITTED') throw new Error('TASK_NOT_VERIFIED')
        if (task.status !== 'VERIFIED') throw new Error('TASK_NOT_SUBMITTED')
        if (task.order.status !== 'RE_RENT_PENDING') throw new Error('ORDER_NOT_PENDING')

        const requestedAt = task.submittedAt
        if (!requestedAt) throw new Error('TIME_UNAVAILABLE')

        const setting = await tx.platformSetting.findFirst({ select: { rerentDelaySeconds: true } })
        const delaySeconds = Number(setting?.rerentDelaySeconds ?? 90)
        if (!Number.isInteger(delaySeconds) || delaySeconds < 0 || delaySeconds > 86400) {
          throw new Error('INVALID_DELAY')
        }

        const remainingSeconds = Math.ceil(delaySeconds - (Date.now() - requestedAt.getTime()) / 1000)
        if (remainingSeconds > 0) {
          return { status: 'PROCESSING', remainingSeconds }
        }

        const claimTime = new Date()
        const claimed = await tx.task.updateMany({
          where: { id: task.id, userId, managerId, type: 'RE_RENT', status: 'VERIFIED' },
          data: { status: 'IN_PROGRESS', startedAt: claimTime },
        })
        if (claimed.count !== 1) throw new Error('TASK_ALREADY_PROCESSED')

        const order = await tx.order.findFirst({
          where: { id: task.order.id, userId, managerId, status: 'RE_RENT_PENDING' },
          select: {
            id: true,
            userId: true,
            managerId: true,
            orderCode: true,
            amount: true,
            paymentStatus: true,
            paymentVerifiedAt: true,
          },
        })
        if (!order) throw new Error('ORDER_ALREADY_PROCESSED')
        if (order.paymentStatus !== 'PAID' || !order.paymentVerifiedAt) throw new Error('PAYMENT_NOT_VERIFIED')

        const existingCredit = await tx.transaction.findFirst({
          where: { userId, managerId, type: 'PROFIT', reference: task.id },
          select: { id: true },
        })
        if (existingCredit) throw new Error('TASK_ALREADY_CREDITED')

        const profitRate = new Decimal(task.profitRate.toString())
        if (!profitRate.isFinite() || !profitRate.gt(0) || profitRate.gt(100) || profitRate.decimalPlaces() > 2) {
          throw new Error('INVALID_PROFIT_RATE')
        }
        const orderAmount = new Decimal(order.amount.toString())
        const profit = orderAmount.mul(profitRate).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        if (!profit.isFinite() || profit.isNegative()) throw new Error('INVALID_PROFIT')

        const completedAt = new Date()
        const orderUpdated = await tx.order.updateMany({
          where: { id: order.id, userId, managerId, status: 'RE_RENT_PENDING' },
          data: {
            status: 'RE_RENTED',
            profitRate,
            profit,
            rerentedAt: completedAt,
            completedAt,
          },
        })
        if (orderUpdated.count !== 1) throw new Error('ORDER_ALREADY_PROCESSED')

        const wallet = await tx.wallet.findUnique({
          where: { userId },
          select: { balance: true },
        })
        if (!wallet) throw new Error('WALLET_NOT_FOUND')

        const balanceBefore = new Decimal(wallet.balance.toString())
        const balanceAfter = balanceBefore.add(profit)
        await tx.wallet.update({ where: { userId }, data: { balance: { increment: profit } } })

        const taskUpdated = await tx.task.updateMany({
          where: { id: task.id, userId, managerId, status: 'IN_PROGRESS' },
          data: { status: 'COMPLETED', completedAt, profitRate, profitAmount: profit },
        })
        if (taskUpdated.count !== 1) throw new Error('TASK_FINALIZATION_FAILED')

        await tx.transaction.create({
          data: {
            userId,
            managerId,
            type: 'PROFIT',
            amount: profit,
            reference: task.id,
            balanceBefore,
            balanceAfter,
            note: `Re-Rent profit for order ${order.orderCode} at ${profitRate.toFixed(2)}%`,
          },
        })
        await tx.notification.create({
          data: {
            userId,
            type: 'SUCCESS',
            title: 'Re-Rent completed',
            message: `Your order has been re-rented successfully. ${profitRate.toFixed(2)}% profit of ${profit.toFixed(2)} has been added to your wallet.`,
          },
        })
        await tx.auditLog.create({
          data: {
            actorType: 'USER',
            actorId: userId,
            managerId,
            action: 'RERENT_SETTLED',
            targetType: 'ORDER',
            targetId: order.id,
            amount: profit,
            metadata: {
              orderCode: order.orderCode,
              userId,
              managerId,
              orderAmount: orderAmount.toString(),
              profitRate: profitRate.toFixed(2),
              profit: profit.toFixed(2),
              taskId: task.id,
              settlementSource: source,
            },
          },
        })

        return {
          status: 'COMPLETED',
          taskId: task.id,
          orderId: order.id,
          orderCode: order.orderCode,
          profit: profit.toFixed(2),
          profitRate: profitRate.toFixed(2),
          alreadyCompleted: false,
        }
      }, { isolationLevel: 'Serializable' })
    } catch (error) {
      if (isSerializationConflict(error) && attempt < MAX_SETTLEMENT_RETRIES) continue
      throw error
    }
  }
}
