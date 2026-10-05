import { Prisma, type PrismaClient } from '@prisma/client'
import { getClientDayEligibilityCutoff } from '@/lib/client-day'
import { syncDailyTaskProgress } from '@/lib/daily-task-progression'
import { findRotatingWindow, getSchedulerWindowOffset } from '@/lib/scheduler-window'

const DAILY_BATCH_SIZE = 40
const SERIALIZATION_RETRIES = 3

function eligibilityAnchorBefore(cutoff: Date): Prisma.UserWhereInput {
  return {
    OR: [
      { approvedAt: { lt: cutoff } },
      { approvedAt: null, createdAt: { lt: cutoff } },
    ],
  }
}

function verifiedActiveBooking(): Prisma.UserWhereInput {
  return {
    orders: {
      some: {
        status: 'ACTIVE',
        paymentStatus: 'PAID',
        paymentVerifiedAt: { not: null },
      },
    },
  }
}

function taskMissingOrNeedsBooking(type: 'DAY_2_MORNING' | 'DAY_2_AFTERNOON' | 'DAY_3_OFFICIAL'): Prisma.UserWhereInput {
  return {
    OR: [
      { tasks: { none: { type } } },
      { tasks: { some: { type, orderId: null, status: { in: ['PENDING', 'IN_PROGRESS'] } } } },
    ],
  }
}

/** Only clients with due, incomplete progression work enter this batch. */
export function getDailyProgressionCandidatesWhere(now = new Date()): Prisma.UserWhereInput {
  const activeClient: Prisma.UserWhereInput = {
    status: 'ACTIVE',
    signupStatus: 'APPROVED',
    manager: { is: { status: 'ACTIVE' } },
  }

  const day2NeedsTasks: Prisma.UserWhereInput = {
    AND: [
      activeClient,
      eligibilityAnchorBefore(getClientDayEligibilityCutoff(2, now)),
      verifiedActiveBooking(),
      { membershipStatus: { in: ['DAY_1', 'DAY_2'] } },
      {
        OR: [
          taskMissingOrNeedsBooking('DAY_2_MORNING'),
          taskMissingOrNeedsBooking('DAY_2_AFTERNOON'),
        ],
      },
    ],
  }

  // The existing progression helper can also repair a lagging membership
  // state after both Day 2 task credits already exist.
  const day2NeedsMembershipSync: Prisma.UserWhereInput = {
    AND: [
      activeClient,
      { membershipStatus: { in: ['DAY_1', 'DAY_2'] } },
      { tasks: { some: { type: 'DAY_2_MORNING', status: 'COMPLETED' } } },
      { tasks: { some: { type: 'DAY_2_AFTERNOON', status: 'COMPLETED' } } },
    ],
  }

  const day3NeedsTask: Prisma.UserWhereInput = {
    AND: [
      activeClient,
      { membershipStatus: 'OFFICIAL_MEMBER' },
      eligibilityAnchorBefore(getClientDayEligibilityCutoff(3, now)),
      verifiedActiveBooking(),
      { tasks: { some: { type: 'DAY_2_MORNING', status: 'COMPLETED' } } },
      { tasks: { some: { type: 'DAY_2_AFTERNOON', status: 'COMPLETED' } } },
      taskMissingOrNeedsBooking('DAY_3_OFFICIAL'),
    ],
  }

  return { OR: [day2NeedsTasks, day2NeedsMembershipSync, day3NeedsTask] }
}

function isSerializationConflict(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2034')
}

async function syncOneClient(prisma: PrismaClient, userId: string, managerId: string, now: Date) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma.$transaction(
        (tx) => syncDailyTaskProgress(tx, userId, managerId, now),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
    } catch (error) {
      if (isSerializationConflict(error) && attempt < SERIALIZATION_RETRIES) continue
      throw error
    }
  }
}

function safeErrorCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code.slice(0, 32)
  }
  return 'UNKNOWN'
}

export async function processDailyProgressionBatch(prisma: PrismaClient, now = new Date()) {
  const where = getDailyProgressionCandidatesWhere(now)
  const eligible = await prisma.user.count({ where })
  if (!eligible) return { considered: 0, processed: 0, failed: 0, hasMore: false }

  const offset = getSchedulerWindowOffset(now, eligible, DAILY_BATCH_SIZE)
  const clients = await findRotatingWindow({
    count: eligible,
    batchSize: DAILY_BATCH_SIZE,
    offset,
    findMany: (args) => prisma.user.findMany({
      where,
      orderBy: [{ id: 'asc' }],
      ...args,
      select: { id: true, managerId: true },
    }),
  })

  let processed = 0
  let failed = 0
  const failuresByCode: Record<string, number> = {}
  for (const client of clients) {
    try {
      await syncOneClient(prisma, client.id, client.managerId, now)
      processed += 1
    } catch (error) {
      failed += 1
      const code = safeErrorCode(error)
      failuresByCode[code] = (failuresByCode[code] || 0) + 1
    }
  }

  return { considered: clients.length, processed, failed, failuresByCode, hasMore: eligible > clients.length }
}
