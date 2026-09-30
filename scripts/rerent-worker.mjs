import { PrismaClient } from '@prisma/client'
import { settleReRentTask } from '../lib/rerent-settlement.mjs'

const prisma = new PrismaClient()
const pollIntervalMs = 5_000
const batchSize = 50
const concurrency = 4
let stopping = false

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopping = true
  })
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function processCandidate(candidate) {
  try {
    await settleReRentTask(prisma, {
      taskId: candidate.id,
      userId: candidate.userId,
      managerId: candidate.managerId,
      source: 'WORKER',
    })
    return null
  } catch (error) {
    // Task IDs, user IDs and financial data are deliberately excluded from logs.
    return error instanceof Error ? error.message : 'UNKNOWN_ERROR'
  }
}

async function runBatch() {
  const candidates = await prisma.task.findMany({
    where: {
      type: 'RE_RENT',
      status: 'VERIFIED',
      submittedAt: { not: null },
      orderId: { not: null },
      user: {
        is: {
          status: 'ACTIVE',
          signupStatus: 'APPROVED',
          manager: { is: { status: 'ACTIVE' } },
        },
      },
      order: {
        is: {
          status: 'RE_RENT_PENDING',
          paymentStatus: 'PAID',
          paymentVerifiedAt: { not: null },
        },
      },
    },
    orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
    take: batchSize,
    select: { id: true, userId: true, managerId: true },
  })

  let failures = 0
  const failureCodes = new Map()
  for (let offset = 0; offset < candidates.length; offset += concurrency) {
    const outcomes = await Promise.all(candidates.slice(offset, offset + concurrency).map(processCandidate))
    for (const code of outcomes) {
      if (code) {
        failures += 1
        failureCodes.set(code, (failureCodes.get(code) || 0) + 1)
      }
    }
  }
  if (failures) {
    console.error('RERENT_WORKER_BATCH_ERRORS', Object.fromEntries(failureCodes))
  }
}

console.info('Re-Rent settlement worker started')
try {
  while (!stopping) {
    try {
      await runBatch()
    } catch {
      // Database outage details can contain connection data; keep logs generic.
      console.error('RERENT_WORKER_DATABASE_UNAVAILABLE')
    }
    if (!stopping) await pause(pollIntervalMs)
  }
} finally {
  await prisma.$disconnect()
  console.info('Re-Rent settlement worker stopped')
}
