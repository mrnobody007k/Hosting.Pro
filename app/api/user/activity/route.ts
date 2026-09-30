import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getSession()
    if (!session || session.role !== 'USER' || !session.managerId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const user = await prisma.user.findFirst({
      where: {
        id: session.sub,
        managerId: session.managerId,
        status: 'ACTIVE',
        signupStatus: 'APPROVED',
        manager: { status: 'ACTIVE' },
      },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: 'Your account is not available.' }, { status: 403 })

    const [orders, tasks, deposits, withdrawals, transactions, notifications] = await Promise.all([
      prisma.order.findMany({
        where: { userId: user.id, managerId: session.managerId },
        orderBy: { createdAt: 'desc' }, take: 20,
        select: { id: true, orderCode: true, status: true, paymentStatus: true, amount: true, createdAt: true, property: { select: { title: true } } },
      }),
      prisma.task.findMany({
        where: { userId: user.id, managerId: session.managerId },
        orderBy: { updatedAt: 'desc' }, take: 20,
        select: { id: true, title: true, type: true, dayNumber: true, status: true, profitAmount: true, createdAt: true, submittedAt: true, completedAt: true },
      }),
      prisma.deposit.findMany({ where: { userId: user.id, managerId: session.managerId }, orderBy: { createdAt: 'desc' }, take: 15, select: { id: true, amount: true, status: true, createdAt: true } }),
      prisma.withdrawal.findMany({ where: { userId: user.id, managerId: session.managerId }, orderBy: { createdAt: 'desc' }, take: 15, select: { id: true, amount: true, status: true, method: true, createdAt: true, processedAt: true } }),
      prisma.transaction.findMany({ where: { userId: user.id, managerId: session.managerId }, orderBy: { createdAt: 'desc' }, take: 25, select: { id: true, type: true, amount: true, createdAt: true } }),
      prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 15, select: { id: true, title: true, message: true, isRead: true, createdAt: true } }),
    ])

    const events = [
      ...orders.map((item) => ({ id: `order:${item.id}`, kind: 'ORDER', title: item.property.title, detail: `Booking ${item.orderCode} · ${item.paymentStatus.replaceAll('_', ' ').toLowerCase()}`, status: item.status, amount: item.amount.toString(), createdAt: item.createdAt })),
      ...tasks.map((item) => ({ id: `task:${item.id}`, kind: 'TASK', title: item.title, detail: `Day ${item.dayNumber} · ${item.type.replaceAll('_', ' ').toLowerCase()}`, status: item.status, amount: item.status === 'COMPLETED' ? null : item.profitAmount.toString(), createdAt: item.completedAt || item.submittedAt || item.createdAt })),
      ...deposits.map((item) => ({ id: `deposit:${item.id}`, kind: 'DEPOSIT', title: 'Deposit request', detail: 'Wallet funding request', status: item.status, amount: item.amount.toString(), createdAt: item.createdAt })),
      ...withdrawals.map((item) => ({ id: `withdrawal:${item.id}`, kind: 'WITHDRAWAL', title: 'Withdrawal request', detail: item.method || 'Payout request', status: item.status, amount: item.amount.toString(), createdAt: item.processedAt || item.createdAt })),
      ...transactions.map((item) => ({ id: `transaction:${item.id}`, kind: 'WALLET', title: item.type === 'WELCOME_BONUS' ? 'Welcome balance' : item.type === 'PROFIT' ? 'Earnings credited' : `Wallet ${item.type.toLowerCase()}`, detail: 'Wallet transaction', status: 'RECORDED', amount: item.amount.toString(), createdAt: item.createdAt })),
      ...notifications.map((item) => ({ id: `notification:${item.id}`, kind: 'NOTIFICATION', title: item.title, detail: item.message, status: item.isRead ? 'READ' : 'UNREAD', amount: null, createdAt: item.createdAt })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 60)

    return NextResponse.json({ events })
  } catch (error) {
    console.error('USER_ACTIVITY_GET_ERROR', error)
    return NextResponse.json({ error: 'Unable to load your activity.' }, { status: 500 })
  }
}
