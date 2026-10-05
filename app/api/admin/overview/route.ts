import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/admin-auth'
import { AdminPermission } from '@/lib/admin-permissions'
import { Decimal } from 'decimal.js'

export async function GET() {
  try {
    const auth = await requireAdminAuth(AdminPermission.VIEW_DASHBOARD)
    if (!auth.ok) return auth.response
    const session = auth.session
    const can = (permission: string) => session.adminType === 'SUPER_ADMIN' || session.permissions.includes(permission)

    const storedSetting = await prisma.platformSetting.findFirst({
      select: {
        id: true,
        managerSeatLimit: true,
        welcomeBalance: true,
        day2ProfitRate: true,
        day3ProfitRate: true,
        rerentDelaySeconds: true,
        depositInstructions: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    const setting = storedSetting ?? {
      id: null,
      managerSeatLimit: 10,
      welcomeBalance: '120.00',
      day2ProfitRate: '1.20',
      day3ProfitRate: '1.40',
      rerentDelaySeconds: 90,
      depositInstructions: 'Use the payment details shared with your Housing.pro account, then submit your payment reference or proof.',
      createdAt: null,
      updatedAt: null,
    }

    const [
      activeManagers,
      users,
      pendingD,
      pendingW,
      activeClients,
      pendingSignups,
      activeProperties,
      activeOrders,
      pendingPaymentOrders,
      pendingTasks,
      completedTasks,
      profitTotals,
      rerentProfitTotals,
      managers,
      recentDeposits,
      recentWithdrawals,
      recentTransactions,
      recentUsers,
      recentOrders,
      recentAudit,
    ] = await Promise.all([
      prisma.manager.count({
        where: {
          status: 'ACTIVE',
        },
      }),

      prisma.user.count(),

      prisma.deposit.count({
        where: {
          status: 'PENDING',
        },
      }),

      prisma.withdrawal.count({
        where: {
          status: 'PENDING',
        },
      }),

      prisma.user.count({ where: { status: 'ACTIVE', signupStatus: 'APPROVED' } }),
      prisma.user.count({ where: { signupStatus: 'PENDING' } }),
      prisma.property.count({ where: { status: 'ACTIVE' } }),
      prisma.order.count({ where: { status: { in: ['ACTIVE', 'RE_RENT_PENDING', 'RE_RENTED'] } } }),
      prisma.order.count({ where: { status: { in: ['PAYMENT_PENDING', 'PAYMENT_SUBMITTED'] } } }),
      prisma.task.count({ where: { status: { in: ['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'VERIFIED'] } } }),
      prisma.task.count({ where: { status: 'COMPLETED' } }),
      can('VIEW_REVENUE') ? prisma.transaction.aggregate({
        where: { type: 'PROFIT' },
        _sum: { amount: true },
        _count: { _all: true },
      }) : Promise.resolve({ _sum: { amount: null }, _count: { _all: 0 } }),

      can('VIEW_REVENUE') ? prisma.order.aggregate({
        where: { status: { in: ['RE_RENTED', 'COMPLETED'] }, finalReturnAmount: { not: null } },
        _sum: { profit: true },
      }) : Promise.resolve({ _sum: { profit: null } }),

      can('MANAGE_MANAGERS') ? prisma.manager.findMany({
        take: 200,
        select: {
          id: true,
          name: true,
          email: true,
          referralCode: true,
          status: true,
          paymentAccountLabel: true,
          paymentAccountDetails: true,
          createdAt: true,
          _count: {
            select: {
              users: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }) : Promise.resolve([]),

      can('MANAGE_DEPOSITS') ? prisma.deposit.findMany({
        take: 25,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          amount: true,
          status: true,
          reference: true,
          createdAt: true,
          processedAt: true,
          manager: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }) : Promise.resolve([]),

      can('MANAGE_WITHDRAWALS') ? prisma.withdrawal.findMany({
        take: 25,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          amount: true,
          status: true,
          method: true,
          reference: true,
          createdAt: true,
          processedAt: true,
          manager: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }) : Promise.resolve([]),

      can('VIEW_REVENUE') ? prisma.transaction.findMany({
        take: 50,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          type: true,
          amount: true,
          balanceBefore: true,
          balanceAfter: true,
          reference: true,
          createdAt: true,
          manager: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }) : Promise.resolve([]),

      can('MANAGE_USERS') ? prisma.user.findMany({
        take: 25,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          createdAt: true,
          manager: {
            select: {
              id: true,
              name: true,
              referralCode: true,
            },
          },
          wallet: {
            select: {
              balance: true,
              reservedBalance: true,
            },
          },
        },
      }) : Promise.resolve([]),

      can('MANAGE_ORDERS') ? prisma.order.findMany({
        take: 12,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: {
          id: true,
          orderCode: true,
          amount: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
          manager: { select: { id: true, name: true } },
          property: { select: { id: true, title: true } },
        },
      }) : Promise.resolve([]),

      can('VIEW_ACTIVITY') ? prisma.auditLog.findMany({
        take: 75,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          actorType: true,
          actorId: true,
          managerId: true,
          action: true,
          targetType: true,
          targetId: true,
          amount: true,
          createdAt: true,
        },
      }) : Promise.resolve([]),
    ])

    return NextResponse.json({
      setting: {
        ...setting,
        welcomeBalance: typeof setting.welcomeBalance === 'string' ? setting.welcomeBalance : setting.welcomeBalance.toString(),
        day2ProfitRate: typeof setting.day2ProfitRate === 'string' ? setting.day2ProfitRate : setting.day2ProfitRate.toString(),
        day3ProfitRate: typeof setting.day3ProfitRate === 'string' ? setting.day3ProfitRate : setting.day3ProfitRate.toString(),
      },
      stats: {
        activeManagers,
        users,
        activeClients,
        pendingSignups,
        activeProperties,
        activeOrders,
        pendingPaymentOrders,
        pendingD,
        pendingW,
        pendingTasks,
        completedTasks,
        taskProfit: profitTotals._sum.amount?.toString() ?? '0.00',
        reRentRevenue: rerentProfitTotals._sum.profit?.toString() ?? '0.00',
        totalRevenue: new Decimal(profitTotals._sum.amount?.toString() ?? '0').plus(rerentProfitTotals._sum.profit?.toString() ?? '0').toFixed(2),
        profitTransactionCount: profitTotals._count._all,
        managerSeatLimit: setting.managerSeatLimit,
      },
      capabilities: {
        manageManagers: can('MANAGE_MANAGERS'),
        managePlatformSettings: can('MANAGE_PLATFORM_SETTINGS'),
        viewRevenue: can('VIEW_REVENUE'),
        viewOrders: can('MANAGE_ORDERS'),
        viewActivity: can('VIEW_ACTIVITY'),
        viewClients: can('MANAGE_USERS'),
        viewDeposits: can('MANAGE_DEPOSITS'),
        viewWithdrawals: can('MANAGE_WITHDRAWALS'),
        viewTasks: can('MANAGE_TASKS'),
      },
      managers,
      recentDeposits,
      recentWithdrawals,
      recentTransactions,
      recentUsers,
      recentOrders: recentOrders.map((order) => ({ ...order, amount: order.amount.toString() })),
      recentAudit,
    })
  } catch (error) {
    console.error(
      'ADMIN_OVERVIEW_ERROR',
      error,
    )

    return NextResponse.json(
      {
        error:
          'Unable to load admin overview.',
      },
      { status: 500 },
    )
  }
}
