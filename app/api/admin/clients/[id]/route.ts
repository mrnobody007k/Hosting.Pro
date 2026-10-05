import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/admin-auth'
import { AdminPermission } from '@/lib/admin-permissions'
import { Prisma } from '@prisma/client'
import { canAssignDisplayTier, isDisplayTier } from '@/lib/display-tier'
import { handleRequestSecurityError, readJson, requireSameOrigin } from '@/lib/security'

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
        displayTier: true,
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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request)
    const auth = await requireAdminAuth(AdminPermission.MANAGE_USERS)
    if (!auth.ok) return auth.response
    if (!canAssignDisplayTier(auth.session)) {
      return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 })
    }

    const { id } = await context.params
    if (!id || id.length > 100) return NextResponse.json({ error: 'Invalid client.' }, { status: 400 })
    const body = await readJson<{ displayTier?: unknown }>(request, 4 * 1024)
    const requestedTier = body?.displayTier
    if (!isDisplayTier(requestedTier)) {
      return NextResponse.json({ error: 'Choose Gold, Diamond, or Merchant.' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const client = await tx.user.findUnique({
        where: { id },
        select: { displayTier: true, managerId: true },
      })
      if (!client) return null
      if (client.displayTier === requestedTier) {
        return { displayTier: client.displayTier, changed: false }
      }

      const update = await tx.user.updateMany({
        where: { id, displayTier: client.displayTier },
        data: { displayTier: requestedTier },
      })
      if (update.count !== 1) throw new Error('DISPLAY_TIER_UPDATE_CONFLICT')

      await tx.auditLog.create({
        data: {
          actorType: 'ADMIN',
          actorId: auth.session.sub,
          managerId: client.managerId,
          action: 'USER_DISPLAY_TIER_CHANGED',
          targetType: 'USER',
          targetId: id,
          metadata: { previousTier: client.displayTier, displayTier: requestedTier },
        },
      })

      return { displayTier: requestedTier, changed: true }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    if (!result) return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const securityResponse = handleRequestSecurityError(error)
    if (securityResponse) return securityResponse
    const code = error instanceof Error ? error.message : ''
    if (code === 'DISPLAY_TIER_UPDATE_CONFLICT') {
      return NextResponse.json({ error: 'The client tier changed at the same time. Reload and try again.' }, { status: 409 })
    }
    console.error('ADMIN_CLIENT_TIER_UPDATE_ERROR', error)
    return NextResponse.json({ error: 'Unable to update client tier.' }, { status: 500 })
  }
}
