import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/admin-auth'
import { AdminPermission } from '@/lib/admin-permissions'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdminAuth(AdminPermission.MANAGE_USERS)
    if (!auth.ok) return auth.response
    const { id } = await context.params
    if (!id || id.length > 100) return NextResponse.json({ error: 'Invalid client.' }, { status: 400 })
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, age: true, profession: true, phone: true,
        status: true, signupStatus: true, membershipStatus: true, approvedAt: true,
        officialMemberAt: true, createdAt: true, managerId: true,
        manager: { select: { id: true, name: true, email: true, referralCode: true } },
        wallet: { select: { balance: true, reservedBalance: true, updatedAt: true } },
      },
    })
    if (!user) return NextResponse.json({ error: 'Client not found.' }, { status: 404 })

    const [orders, tasks, deposits, withdrawals, transactions, notifications, activity] = await Promise.all([
      prisma.order.findMany({ where: { userId: id }, take: 25, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], select: { id: true, orderCode: true, amount: true, profit: true, profitRate: true, status: true, paymentStatus: true, paymentReference: true, bookedAt: true, paymentSubmittedAt: true, paymentVerifiedAt: true, activatedAt: true, rerentRequestedAt: true, rerentedAt: true, completedAt: true, createdAt: true, property: { select: { id: true, title: true, location: true } }, tasks: { take: 5, orderBy: { createdAt: 'desc' }, select: { id: true, type: true, status: true, assignedAt: true, submittedAt: true, completedAt: true } } } }),
      prisma.task.findMany({ where: { userId: id }, take: 25, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], select: { id: true, type: true, title: true, dayNumber: true, profitRate: true, profitAmount: true, status: true, assignedAt: true, submittedAt: true, completedAt: true, order: { select: { id: true, orderCode: true } } } }),
      prisma.deposit.findMany({ where: { userId: id }, take: 25, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], select: { id: true, amount: true, status: true, reference: true, proofUrl: true, note: true, createdAt: true, processedAt: true } }),
      prisma.withdrawal.findMany({ where: { userId: id }, take: 25, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], select: { id: true, amount: true, status: true, method: true, reference: true, createdAt: true, processedAt: true } }),
      prisma.transaction.findMany({ where: { userId: id }, take: 50, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], select: { id: true, type: true, amount: true, balanceBefore: true, balanceAfter: true, reference: true, note: true, createdAt: true } }),
      prisma.notification.findMany({ where: { userId: id }, take: 25, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], select: { id: true, type: true, title: true, message: true, isRead: true, createdAt: true } }),
      prisma.auditLog.findMany({ where: { OR: [{ actorId: id }, { targetId: id }] }, take: 25, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], select: { id: true, actorType: true, action: true, targetType: true, amount: true, createdAt: true } }),
    ])
    return NextResponse.json({
      client: { ...user, wallet: user.wallet ? { ...user.wallet, balance: user.wallet.balance.toString(), reservedBalance: user.wallet.reservedBalance.toString() } : null },
      orders: orders.map((row) => ({ ...row, amount: row.amount.toString(), profit: row.profit.toString(), profitRate: row.profitRate.toString() })),
      tasks: tasks.map((row) => ({ ...row, profitRate: row.profitRate.toString(), profitAmount: row.profitAmount.toString() })),
      deposits: deposits.map((row) => ({ ...row, amount: row.amount.toString() })),
      withdrawals: withdrawals.map((row) => ({ ...row, amount: row.amount.toString() })),
      transactions: transactions.map((row) => ({ ...row, amount: row.amount.toString(), balanceBefore: row.balanceBefore.toString(), balanceAfter: row.balanceAfter.toString() })),
      notifications,
      activity: activity.map((row) => ({ ...row, amount: row.amount?.toString() ?? null })),
      limits: { orders: 25, tasks: 25, deposits: 25, withdrawals: 25, transactions: 50, notifications: 25, activity: 25 },
    })
  } catch (error) {
    console.error('ADMIN_CLIENT_DETAIL_ERROR', error)
    return NextResponse.json({ error: 'Unable to load client details.' }, { status: 500 })
  }
}
