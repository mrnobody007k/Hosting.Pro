import { NextResponse } from 'next/server'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

function getClientDay(createdAt: Date, approvedAt: Date | null) {
  const start = approvedAt || createdAt

  const startDay = new Date(start)
  startDay.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const diff = Math.floor(
    (today.getTime() - startDay.getTime()) / 86400000,
  )

  return Math.max(1, diff + 1)
}

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
      paymentAccountLabel: true,
      paymentAccountDetails: true,
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
    deposits,
    withdrawals,
    balanceAggregate,
    orderCount,
    pendingTaskCount,
  ] = await Promise.all([
    prisma.user.findMany({
      where: {
        managerId: session.managerId,
      },
      orderBy: {
        createdAt: 'desc',
      },
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

    prisma.deposit.findMany({
      where: {
        managerId: session.managerId,
        status: 'PENDING',
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        amount: true,
        reference: true,
        proofUrl: true,
        status: true,
        note: true,
        createdAt: true,
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
      where: {
        managerId: session.managerId,
        status: {
          in: ['PENDING', 'APPROVED'],
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        amount: true,
        method: true,
        accountDetails: true,
        reference: true,
        status: true,
        note: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
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
          in: ['PENDING', 'IN_PROGRESS', 'SUBMITTED'],
        },
      },
    }),
  ])

  const safeUsers = users.map((user) => ({
    ...user,
    clientDay: getClientDay(user.createdAt, user.approvedAt),
    availableBalance: new Decimal(user.wallet?.balance?.toString() || '0').sub(user.wallet?.reservedBalance?.toString() || '0').toString(),
  }))

  const safePendingSignups = pendingSignups.map((user) => ({
    ...user,
    clientDay: getClientDay(user.createdAt, null),
  }))

  const totalBalance = new Decimal(balanceAggregate._sum.balance?.toString() || '0')
  const reservedBalance = new Decimal(balanceAggregate._sum.reservedBalance?.toString() || '0')

  return NextResponse.json({
    manager,

    stats: {
      users: users.length,
      newSignups: pendingSignups.length,
      pendingD: deposits.length,
      pendingW: withdrawals.length,
      balance: totalBalance.toString(),
      availableBalance: totalBalance.sub(reservedBalance).toString(),
      activeOrders: orderCount,
      pendingTasks: pendingTaskCount,
    },

    users: safeUsers,
    pendingSignups: safePendingSignups,
    deposits,
    withdrawals,
  })
}
