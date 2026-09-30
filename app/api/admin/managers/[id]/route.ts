import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/admin-auth'
import { AdminPermission } from '@/lib/admin-permissions'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdminAuth(AdminPermission.MANAGE_MANAGERS)
    if (!auth.ok) return auth.response
    const { id } = await context.params
    if (!id || id.length > 100) return NextResponse.json({ error: 'Invalid manager.' }, { status: 400 })

    const manager = await prisma.manager.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, referralCode: true,
        paymentAccountLabel: true, paymentAccountDetails: true,
        status: true, createdAt: true,
        _count: { select: { users: true, orders: true, deposits: true, withdrawals: true, tasks: true } },
      },
    })
    if (!manager) return NextResponse.json({ error: 'Manager not found.' }, { status: 404 })

    const [clients, orders, deposits, withdrawals, tasks, activity] = await Promise.all([
      prisma.user.findMany({ where: { managerId: id }, take: 25, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], select: { id: true, name: true, email: true, status: true, signupStatus: true, membershipStatus: true, createdAt: true } }),
      prisma.order.findMany({ where: { managerId: id }, take: 25, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], select: { id: true, orderCode: true, amount: true, status: true, paymentStatus: true, createdAt: true, user: { select: { id: true, name: true } }, property: { select: { id: true, title: true } } } }),
      prisma.deposit.findMany({ where: { managerId: id }, take: 25, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], select: { id: true, amount: true, status: true, reference: true, createdAt: true, processedAt: true, user: { select: { id: true, name: true } } } }),
      prisma.withdrawal.findMany({ where: { managerId: id }, take: 25, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], select: { id: true, amount: true, status: true, method: true, reference: true, createdAt: true, processedAt: true, user: { select: { id: true, name: true } } } }),
      prisma.task.findMany({ where: { managerId: id }, take: 25, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], select: { id: true, type: true, title: true, dayNumber: true, profitRate: true, profitAmount: true, status: true, assignedAt: true, submittedAt: true, completedAt: true, user: { select: { id: true, name: true } }, order: { select: { id: true, orderCode: true } } } }),
      prisma.auditLog.findMany({ where: { managerId: id }, take: 25, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], select: { id: true, actorType: true, action: true, targetType: true, targetId: true, amount: true, createdAt: true } }),
    ])

    return NextResponse.json({
      manager,
      clients,
      orders: orders.map((row) => ({ ...row, amount: row.amount.toString() })),
      deposits: deposits.map((row) => ({ ...row, amount: row.amount.toString() })),
      withdrawals: withdrawals.map((row) => ({ ...row, amount: row.amount.toString() })),
      tasks: tasks.map((row) => ({ ...row, profitRate: row.profitRate.toString(), profitAmount: row.profitAmount.toString() })),
      activity: activity.map((row) => ({ ...row, amount: row.amount?.toString() ?? null })),
      limits: { clients: 25, orders: 25, deposits: 25, withdrawals: 25, tasks: 25, activity: 25 },
    })
  } catch (error) {
    console.error('ADMIN_MANAGER_DETAIL_ERROR', error)
    return NextResponse.json({ error: 'Unable to load manager details.' }, { status: 500 })
  }
}
