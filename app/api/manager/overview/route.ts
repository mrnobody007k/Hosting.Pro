import { NextResponse } from 'next/server'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { getClientDay } from '@/lib/client-day'

export async function GET() {
  const session = await getSession()

  if (!session || session.role !== 'MANAGER' || !session.managerId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    )
  }

  const manager = await prisma.manager.findUnique({
    where: { id: session.managerId },
    select: {
      id: true,
      name: true,
      email: true,
      referralCode: true,
      status: true,
    },
  })

  if (!manager) {
    return NextResponse.json(
      { error: 'Manager not found.' },
      { status: 404 },
    )
  }

  const [
    users,
    pendingSignups,
    balanceAggregate,
    orderCount,
    pendingTaskCount,
    userCounts,
    profitAggregate,
    rerentRevenueAggregate,
    depositLedger,
    withdrawalLedger,
    pendingVerificationCount,
    completedOrderCount,
    activePropertyCount,
    pendingDepositCount,
    pendingWithdrawalCount,
    recentActivity,
  ] = await Promise.all([
    prisma.user.findMany({
      where: {
        managerId: session.managerId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 25,
      select: {
        id: true,
        name: true,
        email: true,
        age: true,
        profession: true,
        phone: true,
        status: true,
        signupStatus: true,
        membershipStatus: true,
        approvedAt: true,
        officialMemberAt: true,
        createdAt: true,
        wallet: {
          select: {
            balance: true,
            reservedBalance: true,
          },
        },
        _count: {
          select: {
            orders: true,
            tasks: true,
          },
        },
      },
    }),

    prisma.user.findMany({
      where: {
        managerId: session.managerId,
        signupStatus: 'PENDING',
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 25,
      select: {
        id: true,
        name: true,
        email: true,
        age: true,
        profession: true,
        phone: true,
        signupStatus: true,
        membershipStatus: true,
        createdAt: true,
      },
    }),

    prisma.wallet.aggregate({
      where: {
        user: {
          managerId: session.managerId,
        },
      },
      _sum: {
        balance: true,
        reservedBalance: true,
      },
    }),

    prisma.order.count({
      where: {
        managerId: session.managerId,
        status: {
          not: 'CANCELLED',
        },
      },
    }),

    prisma.task.count({
      where: {
        managerId: session.managerId,
        status: {
          in: ['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'VERIFIED'],
        },
      },
    }),
    prisma.user.groupBy({ where: { managerId: session.managerId }, by: ['status', 'signupStatus', 'membershipStatus'], _count: { _all: true } }),
    prisma.transaction.aggregate({ where: { managerId: session.managerId, type: 'PROFIT' }, _sum: { amount: true } }),
    prisma.order.aggregate({ where: { managerId: session.managerId, status: { in: ['RE_RENTED', 'COMPLETED'] }, finalReturnAmount: { not: null } }, _sum: { profit: true } }),
    prisma.transaction.aggregate({ where: { managerId: session.managerId, type: 'DEPOSIT' }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { managerId: session.managerId, type: 'WITHDRAWAL' }, _sum: { amount: true } }),
    prisma.order.count({ where: { managerId: session.managerId, status: { in: ['PAYMENT_SUBMITTED', 'PAYMENT_VERIFIED'] } } }),
    prisma.order.count({ where: { managerId: session.managerId, status: { in: ['RE_RENTED', 'COMPLETED'] } } }),
    prisma.property.count({ where: { managerId: session.managerId, status: 'ACTIVE' } }),
    prisma.deposit.count({ where: { managerId: session.managerId, status: 'PENDING' } }),
    prisma.withdrawal.count({ where: { managerId: session.managerId, status: { in: ['PENDING', 'APPROVED'] } } }),
    prisma.auditLog.findMany({ where: { managerId: session.managerId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 8, select: { id: true, action: true, targetType: true, amount: true, createdAt: true } }),
  ])

  const safeUsers = users.map((user) => ({
    ...user,
    clientDay: getClientDay(user.approvedAt, user.createdAt),
    availableBalance: new Decimal(user.wallet?.balance?.toString() || '0').sub(user.wallet?.reservedBalance?.toString() || '0').toString(),
  }))

  const safePendingSignups = pendingSignups.map((user) => ({
    ...user,
    clientDay: getClientDay(null, user.createdAt),
  }))

  const totalBalance = new Decimal(balanceAggregate._sum.balance?.toString() || '0')
  const reservedBalance = new Decimal(balanceAggregate._sum.reservedBalance?.toString() || '0')
  const countUsers = (predicate: (row: { status: string; signupStatus: string; membershipStatus: string; _count: { _all: number } }) => boolean) => userCounts.filter(predicate).reduce((sum, row) => sum + row._count._all, 0)
  const completedProfit = new Decimal(profitAggregate._sum.amount?.toString() || '0').plus(rerentRevenueAggregate._sum.profit?.toString() || '0')

  return NextResponse.json({
    manager,

    stats: {
      users: userCounts.reduce((sum, row) => sum + row._count._all, 0),
      totalClients: userCounts.reduce((sum, row) => sum + row._count._all, 0),
      newSignups: userCounts.filter((row) => row.signupStatus === 'PENDING').reduce((sum, row) => sum + row._count._all, 0),
      pendingSignups: userCounts.filter((row) => row.signupStatus === 'PENDING').reduce((sum, row) => sum + row._count._all, 0),
      pendingD: pendingDepositCount,
      pendingW: pendingWithdrawalCount,
      balance: totalBalance.toString(),
      availableBalance: totalBalance.sub(reservedBalance).toString(),
      activeOrders: orderCount,
      pendingTasks: pendingTaskCount,
      activeClients: countUsers((row) => row.status === 'ACTIVE' && row.signupStatus === 'APPROVED'),
      officialMembers: countUsers((row) => row.membershipStatus === 'OFFICIAL_MEMBER'),
      totalOrders: orderCount,
      pendingOrders: pendingVerificationCount,
      completedOrders: completedOrderCount,
      totalProfit: completedProfit.toFixed(2),
      totalDeposits: new Decimal(depositLedger._sum.amount?.toString() || '0').toFixed(2),
      totalWithdrawals: new Decimal(withdrawalLedger._sum.amount?.toString() || '0').toFixed(2),
      activeProperties: activePropertyCount,
    },

    clients: safeUsers,
    users: safeUsers,
    pendingSignups: safePendingSignups,
    recentActivity: recentActivity.map((row) => ({ ...row, amount: row.amount?.toString() ?? null })),
  })
}
