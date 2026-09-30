import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getClientDay } from '@/lib/client-day'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'MANAGER' || !session.managerId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    const { id } = await context.params
    const client = await prisma.user.findFirst({
      where: { id, managerId: session.managerId },
      select: {
        id: true, name: true, email: true, phone: true, status: true, signupStatus: true,
        membershipStatus: true, createdAt: true, approvedAt: true, officialMemberAt: true,
        wallet: { select: { balance: true, reservedBalance: true } },
      },
    })
    if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 })

    const [manager, orders, tasks, deposits, withdrawals, notifications] = await Promise.all([
      prisma.manager.findUnique({ where: { id: session.managerId }, select: { name: true } }),
      prisma.order.findMany({ where: { userId: id, managerId: session.managerId }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, orderCode: true, amount: true, status: true, paymentStatus: true, createdAt: true, property: { select: { title: true } } } }),
      prisma.task.findMany({ where: { userId: id, managerId: session.managerId }, orderBy: { updatedAt: 'desc' }, take: 10, select: { id: true, title: true, type: true, dayNumber: true, status: true, profitAmount: true, assignedAt: true, submittedAt: true, completedAt: true } }),
      prisma.deposit.findMany({ where: { userId: id, managerId: session.managerId }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, amount: true, status: true, createdAt: true, processedAt: true } }),
      prisma.withdrawal.findMany({ where: { userId: id, managerId: session.managerId }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, amount: true, method: true, status: true, createdAt: true, processedAt: true } }),
      prisma.notification.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, type: true, title: true, message: true, isRead: true, createdAt: true } }),
    ])
    return NextResponse.json({
      client: {
        ...client,
        clientDay: getClientDay(client.approvedAt, client.createdAt),
        wallet: client.wallet ? { balance: client.wallet.balance.toString(), reservedBalance: client.wallet.reservedBalance.toString() } : null,
      },
      manager,
      orders: orders.map((row) => ({ ...row, amount: row.amount.toString() })),
      tasks: tasks.map((row) => ({ ...row, profitAmount: row.profitAmount.toString() })),
      deposits: deposits.map((row) => ({ ...row, amount: row.amount.toString() })),
      withdrawals: withdrawals.map((row) => ({ ...row, amount: row.amount.toString() })),
      notifications,
    })
  } catch (error) {
    console.error('MANAGER_CLIENT_DETAIL_GET_ERROR', error)
    return NextResponse.json({ error: 'Unable to load this client.' }, { status: 500 })
  }
}
