import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { handleRequestSecurityError, readJson, requireSameOrigin } from '@/lib/security'

function customerCopy(value: string) {
  return value
    .replace(/your assigned manager(?:'s)?/gi, 'Housing.pro support')
    .replace(/your manager(?:'s)?/gi, 'Housing.pro support')
    .replace(/manager-provided/gi, 'account payment')
    .replace(/manager/gi, 'Housing.pro')
    .replace(/signup (?:request )?not approved/gi, 'account update')
    .replace(/signup approved/gi, 'account ready')
    .replace(/(?:has been|was) approved/gi, 'is confirmed')
    .replace(/approved/gi, 'confirmed')
    .replace(/must approve/gi, 'must be set up')
    .replace(/approval/gi, 'account setup')
    .replace(/referral code/gi, 'invitation code')
    .replace(/administrator|admin/gi, 'Housing.pro')
}

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'USER' || !session.managerId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const user = await prisma.user.findFirst({
      where: { id: session.sub, managerId: session.managerId },
      select: { id: true, status: true },
    })
    if (!user || user.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Your account is not available.' }, { status: 403 })
    }

    const cursor = new URL(request.url).searchParams.get('cursor')
    if (cursor && (cursor.length > 100 || !(await prisma.notification.findFirst({ where: { id: cursor, userId: user.id }, select: { id: true } })))) {
      return NextResponse.json({ error: 'Invalid notification page cursor.' }, { status: 400 })
    }
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        take: 50,
        select: { id: true, type: true, title: true, message: true, isRead: true, createdAt: true },
      }),
      prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    ])
    return NextResponse.json({
      notifications: notifications.map((notification) => ({
        ...notification,
        title: customerCopy(notification.title),
        message: customerCopy(notification.message),
      })),
      unreadCount,
      nextCursor: notifications.length === 50 ? notifications[notifications.length - 1].id : null,
    })
  } catch (error) {
    console.error('USER_NOTIFICATIONS_GET_ERROR', error)
    return NextResponse.json({ error: 'Unable to load notifications.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request)
    const session = await getSession()
    if (!session || session.role !== 'USER' || !session.managerId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const body = await readJson<{ ids?: unknown; markAll?: unknown }>(request, 16 * 1024)
    const user = await prisma.user.findFirst({
      where: { id: session.sub, managerId: session.managerId, status: 'ACTIVE' },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: 'Your account is not available.' }, { status: 403 })

    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 100).slice(0, 50)
      : []
    if (body?.markAll !== true && ids.length === 0) {
      return NextResponse.json({ error: 'Choose at least one notification.' }, { status: 400 })
    }

    await prisma.notification.updateMany({
      where: { userId: user.id, isRead: false, ...(body?.markAll === true ? {} : { id: { in: ids } }) },
      data: { isRead: true },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const securityResponse = handleRequestSecurityError(error)
    if (securityResponse) return securityResponse
    console.error('USER_NOTIFICATIONS_PATCH_ERROR', error)
    return NextResponse.json({ error: 'Unable to update notifications.' }, { status: 500 })
  }
}
