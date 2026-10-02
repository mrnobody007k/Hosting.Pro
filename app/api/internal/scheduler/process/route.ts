import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processDailyProgressionBatch } from '@/lib/daily-task-scheduler'
import { processReRentBatch } from '@/lib/rerent-scheduler'
import { runIndependentSchedulerJobs } from '@/lib/scheduler-runner'
import { handleSchedulerRequest } from '@/lib/scheduler-handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function POST(request: Request) {
  const response = await handleSchedulerRequest(request, process.env.SCHEDULER_SERVICE_SECRET, () => {
    const now = new Date()
    // Run bounded jobs independently so a failure in one stage does not skip
    // the other. The services own their per-client/per-task transactions.
    return runIndependentSchedulerJobs(
      () => processDailyProgressionBatch(prisma, now),
      () => processReRentBatch(prisma, now),
    )
  })
  return NextResponse.json(response.body, { status: response.status, headers: NO_STORE })
}
