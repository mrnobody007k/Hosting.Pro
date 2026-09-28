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

    const body = await readJson<{ userId?: unknown }>(req)
    const userId = String(body?.userId || '').trim()

    if (!userId || userId.length > 100) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 })
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, managerId: session.managerId },
      select: { id: true, status: true, signupStatus: true, membershipStatus: true, approvedAt: true, createdAt: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Client not found or not under your management.' }, { status: 404 })
    }

    const result = await prisma.$transaction(
      async (tx) => {
        return syncDailyTaskProgress(tx, userId, session.managerId!)
      },
      { isolationLevel: 'Serializable' },
    )

    await prisma.auditLog.create({
      data: {
        actorType: 'MANAGER',
        actorId: session.sub,
        managerId: session.managerId,
        action: 'CLIENT_SYNC_REFRESH',
        targetType: 'USER',
        targetId: userId,
        metadata: { refreshedBy: 'manager' },
      },
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const securityResponse = handleRequestSecurityError(error)
    if (securityResponse) return securityResponse

    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'USER_INACTIVE') {
      return NextResponse.json({ error: 'Client account is not active.' }, { status: 403 })
    }

    console.error('MANAGER_CLIENT_SYNC_ERROR', error)
    return NextResponse.json({ error: 'Unable to sync client.' }, { status: 500 })
  }
}