import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { syncDailyTaskProgress } from '@/lib/daily-task-progression'
import { requireAdminAuth } from '@/lib/admin-auth'
import { AdminPermission } from '@/lib/admin-permissions'
import { requireSameOrigin, readJson, handleRequestSecurityError } from '@/lib/security'

export async function POST(req: Request) {
  try {
    requireSameOrigin(req)

    const auth = await requireAdminAuth(AdminPermission.USE_SYNC)
    if (!auth.ok) return auth.response
    const session = auth.session

    const body = await readJson<{ userId?: unknown; managerId?: unknown }>(req)
    const userId = body?.userId ? String(body.userId).trim() : null
    const managerId = body?.managerId ? String(body.managerId).trim() : null

    if (!userId && !managerId) {
      return NextResponse.json({ error: 'User ID or Manager ID is required.' }, { status: 400 })
    }

    if (userId && userId.length > 100) {
      return NextResponse.json({ error: 'Invalid user ID.' }, { status: 400 })
    }

    if (managerId && managerId.length > 100) {
      return NextResponse.json({ error: 'Invalid manager ID.' }, { status: 400 })
    }

    let targetUsers: { id: string; managerId: string }[] = []

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, managerId: true },
      })
      if (!user) {
        return NextResponse.json({ error: 'User not found.' }, { status: 404 })
      }
      targetUsers = [{ id: user.id, managerId: user.managerId }]
    } else if (managerId) {
      const manager = await prisma.manager.findUnique({
        where: { id: managerId },
        select: { id: true },
      })
      if (!manager) {
        return NextResponse.json({ error: 'Manager not found.' }, { status: 404 })
      }
      const users = await prisma.user.findMany({
        where: { managerId },
        select: { id: true, managerId: true },
      })
      targetUsers = users
    }

    const results = []

    for (const target of targetUsers) {
      try {
        const result = await prisma.$transaction(
          async (tx) => {
            return syncDailyTaskProgress(tx, target.id, target.managerId)
          },
          { isolationLevel: 'Serializable' },
        )
        results.push({ userId: target.id, managerId: target.managerId, ok: true, ...result })
      } catch (e) {
        results.push({ userId: target.id, managerId: target.managerId, ok: false, error: e instanceof Error ? e.message : 'Sync failed' })
      }
    }

    await prisma.auditLog.create({
      data: {
        actorType: 'ADMIN',
        actorId: session.sub,
        action: 'ADMIN_SYNC_REFRESH',
        targetType: userId ? 'USER' : 'MANAGER',
        targetId: userId || managerId,
        metadata: { targetCount: targetUsers.length, results: results.map(r => ({ userId: r.userId, ok: r.ok })) },
      },
    })

    return NextResponse.json({ ok: true, results })
  } catch (error) {
    const securityResponse = handleRequestSecurityError(error)
    if (securityResponse) return securityResponse

    console.error('ADMIN_SYNC_ERROR', error)
    return NextResponse.json({ error: 'Unable to sync.' }, { status: 500 })
  }
}