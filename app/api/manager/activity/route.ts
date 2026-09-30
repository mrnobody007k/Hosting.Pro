import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'MANAGER' || !session.managerId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    const cursor = new URL(request.url).searchParams.get('cursor')
    if (cursor && (cursor.length > 100 || !(await prisma.auditLog.findFirst({ where: { id: cursor, managerId: session.managerId }, select: { id: true } })))) {
      return NextResponse.json({ error: 'Invalid activity page cursor.' }, { status: 400 })
    }
    const [manager, rows] = await Promise.all([prisma.manager.findUnique({ where: { id: session.managerId }, select: { name: true } }), prisma.auditLog.findMany({
      where: { managerId: session.managerId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: 51,
      select: { id: true, actorType: true, action: true, targetType: true, targetId: true, amount: true, createdAt: true },
    })])
    const hasMore = rows.length > 50
    return NextResponse.json({
      manager,
      events: rows.slice(0, 50).map((row) => ({ ...row, amount: row.amount?.toString() ?? null })),
      nextCursor: hasMore ? rows[49].id : null,
    })
  } catch (error) {
    console.error('MANAGER_ACTIVITY_GET_ERROR', error)
    return NextResponse.json({ error: 'Unable to load manager activity.' }, { status: 500 })
  }
}
