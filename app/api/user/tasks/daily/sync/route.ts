import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { readJson, requireSameOrigin, handleRequestSecurityError } from '@/lib/security'
import { syncDailyTaskProgress } from '@/lib/daily-task-progression'

export async function POST(req: Request) {
  try {
    requireSameOrigin(req)
    const session = await getSession()
    if (!session || session.role !== 'USER' || !session.managerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await readJson(req, 16 * 1024)

    const result = await prisma.$transaction(
      async (tx) => {
        return syncDailyTaskProgress(tx, session.sub, session.managerId!)
      },
      { isolationLevel: 'Serializable' }
    )

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const securityResponse = handleRequestSecurityError(error)
    if (securityResponse) return securityResponse

    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'USER_INACTIVE') {
      return NextResponse.json({ error: 'Your account setup is still in progress.' }, { status: 403 })
    }

    console.error('USER_DAILY_TASKS_SYNC_ERROR', error)
    return NextResponse.json({ error: 'Unable to synchronize daily tasks.' }, { status: 500 })
  }
}