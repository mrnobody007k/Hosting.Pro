import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { syncDailyTaskProgress } from '@/lib/daily-task-progression'
import { requireSameOrigin, readJson, handleRequestSecurityError } from '@/lib/security'

export async function POST(req: Request) {
  try {
    requireSameOrigin(req)

    const session = await getSession()

    if (!session || session.role !== 'MANAGER' || !session.managerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await readJson<{}>(req)

    const users = await prisma.user.findMany({
      where: { managerId: session.managerId },
      select: { id: true },
    })

    const results = []

    for (const user of users) {
      try {
        const result = await prisma.$transaction(
          async (tx) => {
            return syncDailyTaskProgress(tx, user.id, session.managerId!)
          },
          { isolationLevel: 'Serializable' },
        )
        results.push({ userId: user.id, ok: true, ...result })
      } catch (e) {
        results.push({ userId: user.id, ok: false, error: e instanceof Error ? e.message : 'Sync failed' })
      }
    }

    await prisma.auditLog.create({
      data: {
        actorType: 'MANAGER',
        actorId: session.sub,
        managerId: session.managerId,
        action: 'MANAGER_BULK_SYNC_REFRESH',
        targetType: 'MANAGER',
        targetId: session.managerId,
        metadata: { clientCount: users.length, results: results.map(r => ({ userId: r.userId, ok: r.ok })) },
      },
    })

    return NextResponse.json({ ok: true, results })
  } catch (error) {
    const securityResponse = handleRequestSecurityError(error)
    if (securityResponse) return securityResponse

    console.error('MANAGER_BULK_SYNC_ERROR', error)
    return NextResponse.json({ error: 'Unable to bulk sync clients.' }, { status: 500 })
  }
}