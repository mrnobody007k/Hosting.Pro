import type { PrismaClient } from '@prisma/client'

export type ReRentSettlementResult = {
  status: 'COMPLETED'
  taskId: string
  orderId: string
  orderCode: string
  finalReturnAmount: string | null
  revenue: string
  alreadyCompleted: boolean
}

export function parseFinalReturnAmount(value: unknown): import('decimal.js').Decimal | null

export function settleReRentTask(
  prisma: PrismaClient,
  input: { taskId: string; managerId: string; managerUserId: string; finalReturnAmount: unknown; now?: Date },
): Promise<ReRentSettlementResult>
