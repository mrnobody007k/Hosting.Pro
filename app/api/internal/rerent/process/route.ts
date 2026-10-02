import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authorizeSchedulerRequest } from '@/lib/scheduler-auth'
import { processReRentBatch } from '@/lib/rerent-scheduler'

/**
 * Compatibility alias for deployments that still reference the former path.
 * Production scheduling should use /api/internal/scheduler/process only.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function POST(request: Request) {
  const auth = authorizeSchedulerRequest(request)
  if (!auth.configured) {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503, headers: NO_STORE })
  }
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers: NO_STORE })
  }

  try {
    const rerent = await processReRentBatch(prisma)
    const ok = rerent.failed === 0
    return NextResponse.json({ ok, rerent }, { status: ok ? 200 : 503, headers: NO_STORE })
  } catch {
    console.error('RERENT_COMPATIBILITY_BATCH_FAILED')
    return NextResponse.json({ error: 'Unable to process scheduled settlements.' }, { status: 503, headers: NO_STORE })
  }
}
