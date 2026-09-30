import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { settleReRentTask } from '@/lib/rerent-settlement.mjs'

export const runtime = 'nodejs'

const BATCH_SIZE = 40
const SETTLEMENT_CONCURRENCY = 4
const DEFAULT_DELAY_SECONDS = 90
const MAX_DELAY_SECONDS = 86_400

function isAuthorized(request: Request) {
  const expectedToken = process.env.RERENT_SCHEDULER_SECRET
  if (!expectedToken || Buffer.byteLength(expectedToken, 'utf8') < 32) {
    return { configured: false, authorized: false }
  }

  const authorization = request.headers.get('authorization') || ''
  const match = /^Bearer ([^\s]+)$/.exec(authorization)
  if (!match) return { configured: true, authorized: false }

  const expected = Buffer.from(expectedToken, 'utf8')
  const provided = Buffer.from(match[1], 'utf8')
  return {
    configured: true,
    authorized: expected.length === provided.length && timingSafeEqual(expected, provided),
  }
}

export async function POST(request: Request) {
  const auth = isAuthorized(request)
  if (!auth.configured) {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 })
  }
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const setting = await prisma.platformSetting.findFirst({
      select: { rerentDelaySeconds: true },
    })
    const delaySeconds = Number(setting?.rerentDelaySeconds ?? DEFAULT_DELAY_SECONDS)
    if (!Number.isInteger(delaySeconds) || delaySeconds < 0 || delaySeconds > MAX_DELAY_SECONDS) {
      return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 })
    }

    const now = new Date()
    const dueBefore = new Date(now.getTime() - delaySeconds * 1000)
    const candidates = await prisma.task.findMany({
      where: {
        type: 'RE_RENT',
        status: 'VERIFIED',
        submittedAt: { lte: dueBefore },
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
      take: BATCH_SIZE,
      select: { id: true, userId: true, managerId: true },
    })

    let completed = 0
    let failed = 0
    for (let offset = 0; offset < candidates.length; offset += SETTLEMENT_CONCURRENCY) {
      const batch = candidates.slice(offset, offset + SETTLEMENT_CONCURRENCY)
      const results = await Promise.all(batch.map(async (task) => {
        try {
          return await settleReRentTask(prisma, {
            taskId: task.id,
            userId: task.userId,
            managerId: task.managerId,
            source: 'SCHEDULER',
          })
        } catch {
          return null
        }
      }))

      for (const result of results) {
        if (result?.status === 'COMPLETED') completed += 1
        else if (result === null) failed += 1
      }
    }

    if (failed > 0) console.error('RERENT_SCHEDULER_TASK_FAILURES', { count: failed })
    return NextResponse.json({
      ok: true,
      processed: completed,
      failed,
      hasMore: candidates.length === BATCH_SIZE,
    })
  } catch {
    console.error('RERENT_SCHEDULER_BATCH_FAILED')
    return NextResponse.json({ error: 'Unable to process scheduled settlements.' }, { status: 503 })
  }
}
