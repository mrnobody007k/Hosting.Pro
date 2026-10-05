import { Prisma, type PrismaClient } from '@prisma/client'
import { findRotatingWindow, getSchedulerWindowOffset } from '@/lib/scheduler-window'

const RERENT_BATCH_SIZE = 40
const DEFAULT_DELAY_SECONDS = 90
const MAX_DELAY_SECONDS = 86_400

export function getReRentCandidatesWhere(dueBefore: Date): Prisma.TaskWhereInput {
  return {
    type: 'RE_RENT',
    status: { in: ['SUBMITTED', 'VERIFIED'] },
    submittedAt: { lte: dueBefore },
    orderId: { not: null },
    user: { is: { status: 'ACTIVE', signupStatus: 'APPROVED', manager: { is: { status: 'ACTIVE' } } } },
    order: { is: { status: 'RE_RENT_PENDING', paymentStatus: 'PAID', paymentVerifiedAt: { not: null } } },
  }
}

/**
 * The scheduler only identifies due Re-Rent tasks for manager review.
 * It never computes a return, mutates task/order state, or credits a wallet.
 */
export async function processReRentBatch(prisma: PrismaClient, now = new Date()) {
  const setting = await prisma.platformSetting.findFirst({ select: { rerentDelaySeconds: true } })
  const delaySeconds = Number(setting?.rerentDelaySeconds ?? DEFAULT_DELAY_SECONDS)
  if (!Number.isInteger(delaySeconds) || delaySeconds < 0 || delaySeconds > MAX_DELAY_SECONDS) throw new Error('INVALID_SCHEDULER_DELAY')

  const dueBefore = new Date(now.getTime() - delaySeconds * 1000)
  const where = getReRentCandidatesWhere(dueBefore)
  const eligible = await prisma.task.count({ where })
  if (!eligible) return { considered: 0, processed: 0, awaitingManager: 0, failed: 0, hasMore: false }

  const offset = getSchedulerWindowOffset(now, eligible, RERENT_BATCH_SIZE)
  const candidates = await findRotatingWindow({
    count: eligible,
    batchSize: RERENT_BATCH_SIZE,
    offset,
    findMany: (args) => prisma.task.findMany({
      where,
      orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
      ...args,
      select: { id: true },
    }),
  })

  return {
    considered: candidates.length,
    processed: 0,
    awaitingManager: candidates.length,
    failed: 0,
    hasMore: eligible > candidates.length,
  }
}
