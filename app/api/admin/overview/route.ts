import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { requireAdminAuth } from '@/lib/admin-auth'
import { AdminPermission } from '@/lib/admin-permissions'

export async function GET() {
  try {
    const auth = await requireAdminAuth(AdminPermission.VIEW_DASHBOARD)
    if (!auth.ok) return auth.response
    const session = auth.session

    const storedSetting = await prisma.platformSetting.findFirst()
    const setting = storedSetting ?? {
      id: null,
      managerSeatLimit: 10,
      welcomeBalance: '120.00',
      day2ProfitRate: '1.20',
      day3ProfitRate: '1.40',
      rerentProfitRate: '1.20',
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
      managers,
      recentDeposits,
      recentWithdrawals,
      recentTransactions,
      recentUsers,
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

      prisma.manager.findMany({
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
      }),

      prisma.deposit.findMany({
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
      }),

      prisma.withdrawal.findMany({
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
      }),

      prisma.transaction.findMany({
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
      }),

      prisma.user.findMany({
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
      }),

      prisma.auditLog.findMany({
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
          metadata: true,
          createdAt: true,
        },
      }),
    ])

    return NextResponse.json({
      setting,
      stats: {
        activeManagers,
        users,
        pendingD,
        pendingW,
      },
      managers,
      recentDeposits,
      recentWithdrawals,
      recentTransactions,
      recentUsers,
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
