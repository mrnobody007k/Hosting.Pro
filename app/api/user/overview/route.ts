import { NextResponse } from 'next/server'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

function customerPaymentInstructions(value: string) {
  return value
    .replace(/the account provided by your assigned manager/gi, 'the payment details shared with your account')
    .replace(/your assigned manager(?:'s)?/gi, 'Housing.pro support')
    .replace(/assigned manager(?:'s)?/gi, 'Housing.pro support')
    .replace(/your manager(?:'s)?/gi, 'Housing.pro support')
    .replace(/manager-provided/gi, 'account payment')
    .replace(/\bmanager(?:'s)?\b/gi, 'Housing.pro support')
    .replace(/\badministrator\b|\badmin\b/gi, 'Housing.pro support')
    .replace(/referral code/gi, 'access code')
    .replace(/must approve/gi, 'will confirm')
    .replace(/approval/gi, 'confirmation')
    .replace(/approved/gi, 'confirmed')
    .replace(/manual verification/gi, 'payment confirmation')
}

export async function GET(request: Request) {
  try {
    const session = await getSession()

    if (
      !session ||
      session.role !== 'USER' ||
      !session.managerId
    ) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      )
    }

    const user =
      await prisma.user.findUnique({
        where: {
          id: session.sub,
        },
        select: {
          id: true,
          name: true,
          email: true,
          age: true,
          profession: true,
          phone: true,
          paymentPasswordHash: true,
          status: true,
          managerId: true,
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
        },
      })

    if (!user) {
      return NextResponse.json(
        {
          error: 'User not found.',
        },
        { status: 404 },
      )
    }

    const { managerId: ownerId, paymentPasswordHash, ...customerUser } = user

    /*
     * Explicit ownership invariant:
     *
     * Session managerId must match the user's
     * database managerId.
     */
    if (
      ownerId !==
      session.managerId
    ) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
        },
        { status: 403 },
      )
    }

    if (user.status !== 'ACTIVE') {
      return NextResponse.json(
        {
          error: 'Your account is not available right now.',
        },
        { status: 403 },
      )
    }

    const accountOwner = await prisma.manager.findFirst({
      where: { id: session.managerId, status: 'ACTIVE' },
      select: { id: true },
    })
    if (!accountOwner) {
      return NextResponse.json(
        {
          error: 'Your account is temporarily unavailable. Please try again later.',
        },
        { status: 403 },
      )
    }

    const includeFinancials = new URL(request.url).searchParams.get('includeFinancials') === '1'
    const [transactions, setting, orderGroups, taskGroups, totalProfit] = await Promise.all([
      includeFinancials ? prisma.transaction.findMany({
        where: {
          userId: user.id,
          managerId: session.managerId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50,
        select: {
          id: true,
          type: true,
          amount: true,
          note: true,
          createdAt: true,
        },
      }) : Promise.resolve([]),
      prisma.platformSetting.findFirst({
        select: { depositInstructions: true },
      }),
      prisma.order.groupBy({ where: { userId: user.id, managerId: session.managerId }, by: ['status'], _count: { _all: true } }),
      prisma.task.groupBy({ where: { userId: user.id, managerId: session.managerId }, by: ['status'], _count: { _all: true } }),
      prisma.transaction.aggregate({ where: { userId: user.id, managerId: session.managerId, type: 'PROFIT' }, _sum: { amount: true }, _count: { _all: true } }),
    ])

    // Profit ledger entries are authoritative. Order.profit is a snapshot of
    // Re-Rent profit and must not be counted as an additional earning.
    const totalProfitAmount = new Decimal(totalProfit._sum.amount?.toString() ?? '0')
    const counts = (groups: Array<{ status: string; _count: { _all: number } }>, statuses: string[]) => groups.filter((group) => statuses.includes(group.status)).reduce((sum, group) => sum + group._count._all, 0)
    let earnings: { total: string; taskProfit: string; rerentProfit: string; day2TaskProfit: string; day3TaskProfit: string; taskCount: number } | null = null
    let walletSummary: { welcomeBonus: string; approvedDeposits: string; approvedWithdrawals: string } | null = null
    if (includeFinancials) {
      const [rerentProfit, day2Profit, day3Profit, welcomeBonus, approvedDeposits, approvedWithdrawals] = await Promise.all([
        prisma.transaction.aggregate({ where: { userId: user.id, managerId: session.managerId, type: 'PROFIT', note: { startsWith: 'Re-Rent profit for order ' } }, _sum: { amount: true }, _count: { _all: true } }),
        prisma.transaction.aggregate({ where: { userId: user.id, managerId: session.managerId, type: 'PROFIT', note: { startsWith: 'Day 2' } }, _sum: { amount: true } }),
        prisma.transaction.aggregate({ where: { userId: user.id, managerId: session.managerId, type: 'PROFIT', note: { startsWith: 'Day 3' } }, _sum: { amount: true } }),
        prisma.transaction.aggregate({ where: { userId: user.id, managerId: session.managerId, type: 'WELCOME_BONUS' }, _sum: { amount: true } }),
        prisma.deposit.aggregate({ where: { userId: user.id, managerId: session.managerId, status: 'APPROVED' }, _sum: { amount: true } }),
        prisma.withdrawal.aggregate({ where: { userId: user.id, managerId: session.managerId, status: 'APPROVED' }, _sum: { amount: true } }),
      ])
      const rerentProfitAmount = new Decimal(rerentProfit._sum.amount?.toString() ?? '0')
      earnings = {
        total: totalProfitAmount.toFixed(2), taskProfit: totalProfitAmount.minus(rerentProfitAmount).toFixed(2),
        rerentProfit: rerentProfitAmount.toFixed(2), day2TaskProfit: new Decimal(day2Profit._sum.amount?.toString() ?? '0').toFixed(2),
        day3TaskProfit: new Decimal(day3Profit._sum.amount?.toString() ?? '0').toFixed(2),
        taskCount: Math.max(0, totalProfit._count._all - rerentProfit._count._all),
      }
      walletSummary = {
        welcomeBonus: new Decimal(welcomeBonus._sum.amount?.toString() ?? '0').toFixed(2),
        approvedDeposits: new Decimal(approvedDeposits._sum.amount?.toString() ?? '0').toFixed(2),
        approvedWithdrawals: new Decimal(approvedWithdrawals._sum.amount?.toString() ?? '0').toFixed(2),
      }
    }
    const availableBalance = user.wallet
      ? user.wallet.balance.sub(user.wallet.reservedBalance).toString()
      : '0.00'

    return NextResponse.json({
      user: { ...customerUser, hasPaymentPassword: Boolean(paymentPasswordHash) },
      wallet: user.wallet ? {
        balance: user.wallet.balance.toString(),
        reservedBalance: user.wallet.reservedBalance.toString(),
      } : null,
      availableBalance,
      earnings,
      walletSummary,
      stats: {
        totalOrders: orderGroups.reduce((sum, group) => sum + group._count._all, 0),
        activeOrders: counts(orderGroups, ['ACTIVE']),
        pendingTasks: counts(taskGroups, ['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'VERIFIED']),
        completedTasks: counts(taskGroups, ['COMPLETED']),
        totalProfit: totalProfitAmount.toFixed(2),
      },
      transactions: transactions.map((transaction) => {
        const note = transaction.type === 'WELCOME_BONUS'
          ? 'Welcome balance credited'
          : transaction.type === 'PROFIT' && transaction.note?.startsWith('Re-Rent profit for order ')
            ? 'Re-Rent profit credited'
            : transaction.type === 'PROFIT' && transaction.note?.startsWith('Day 2')
              ? 'Day 2 task profit credited'
              : transaction.type === 'PROFIT' && transaction.note?.startsWith('Day 3')
                ? 'Day 3 task profit credited'
                : transaction.type === 'PROFIT' ? 'Task profit credited' : null
        return { id: transaction.id, type: transaction.type, amount: transaction.amount.toString(), note, createdAt: transaction.createdAt }
      }),
      setting: {
        depositInstructions: customerPaymentInstructions(String(
          setting?.depositInstructions ||
            'Follow the payment instructions provided for your account, then submit your payment reference or proof.',
        )),
      },
    })
  } catch (error) {
    console.error(
      'USER_OVERVIEW_ERROR',
      error,
    )

    return NextResponse.json(
      {
        error:
          'Unable to load user overview.',
      },
      { status: 500 },
    )
  }
}
