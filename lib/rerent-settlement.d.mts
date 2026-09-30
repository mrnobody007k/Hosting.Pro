import type { PrismaClient } from '@prisma/client'

export type ReRentSettlementResult =
  | { status: 'PROCESSING'; remainingSeconds: number }
  | {
      status: 'COMPLETED'
      taskId: string
      orderId: string
      orderCode: string
      profit: string
      profitRate: string
      alreadyCompleted: boolean
    }

export function settleReRentTask(
  prisma: PrismaClient,
  input: {
    taskId: string
    userId: string
    managerId: string
    source?: string
  },
): Promise<ReRentSettlementResult>
