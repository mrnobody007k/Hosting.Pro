import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getClientDay } from '@/lib/client-day'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'MANAGER' || !session.managerId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const url = new URL(request.url)
    const query = (url.searchParams.get('q') || '').trim().slice(0, 100)
    const status = (url.searchParams.get('status') || 'ALL').toUpperCase()
    const cursor = url.searchParams.get('cursor')
    const allowed = ['ALL', 'ACTIVE', 'DISABLED', 'PENDING', 'APPROVED', 'REJECTED', 'DAY_1', 'DAY_2', 'OFFICIAL_MEMBER']
    if (!allowed.includes(status)) return NextResponse.json({ error: 'Invalid client filter.' }, { status: 400 })

    const where = {
      managerId: session.managerId,
      ...(status === 'ACTIVE' || status === 'DISABLED' ? { status: status as 'ACTIVE' | 'DISABLED' } : {}),
      ...(status === 'PENDING' || status === 'APPROVED' || status === 'REJECTED' ? { signupStatus: status as 'PENDING' | 'APPROVED' | 'REJECTED' } : {}),
      ...(status === 'DAY_1' || status === 'DAY_2' || status === 'OFFICIAL_MEMBER' ? { membershipStatus: status as 'DAY_1' | 'DAY_2' | 'OFFICIAL_MEMBER' } : {}),
      ...(query ? { OR: [
        { name: { contains: query, mode: 'insensitive' as const } },
        { email: { contains: query, mode: 'insensitive' as const } },
        { phone: { contains: query, mode: 'insensitive' as const } },
      ] } : {}),
    }

    const [manager, totalClients, activeClients, officialMembers, pendingSignups] = await Promise.all([
      prisma.manager.findUnique({ where: { id: session.managerId }, select: { name: true } }),
      prisma.user.count({ where: { managerId: session.managerId } }),
      prisma.user.count({ where: { managerId: session.managerId, status: 'ACTIVE', signupStatus: 'APPROVED' } }),
      prisma.user.count({ where: { managerId: session.managerId, membershipStatus: 'OFFICIAL_MEMBER' } }),
      prisma.user.count({ where: { managerId: session.managerId, signupStatus: 'PENDING' } }),
    ])

    if (cursor && (cursor.length > 100 || !(await prisma.user.findFirst({ where: { id: cursor, managerId: session.managerId }, select: { id: true } })))) {
      return NextResponse.json({ error: 'Invalid client page cursor.' }, { status: 400 })
    }

    const rows = await prisma.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: 26,
      select: {
        id: true, name: true, email: true, phone: true, status: true, signupStatus: true,
        membershipStatus: true, createdAt: true, approvedAt: true,
        wallet: { select: { balance: true, reservedBalance: true } },
      },
    })
    const hasMore = rows.length > 25
    const clients = rows.slice(0, 25).map((client) => ({
      ...client,
      clientDay: getClientDay(client.approvedAt, client.createdAt),
      wallet: client.wallet ? { balance: client.wallet.balance.toString(), reservedBalance: client.wallet.reservedBalance.toString() } : null,
    }))
    return NextResponse.json({ clients, manager, stats: { totalClients, activeClients, officialMembers, pendingSignups }, nextCursor: hasMore ? clients.at(-1)?.id || null : null })
  } catch (error) {
    console.error('MANAGER_CLIENTS_GET_ERROR', error)
    return NextResponse.json({ error: 'Unable to load clients.' }, { status: 500 })
  }
}
