import { NextResponse } from 'next/server'
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

export async function GET() {
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

    const [
      transactions,
      deposits,
      withdrawals,
      setting,
    ] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          userId: user.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50,
        select: {
          id: true,
          type: true,
          amount: true,
          balanceBefore: true,
          balanceAfter: true,
          reference: true,
          note: true,
          createdAt: true,
        },
      }),

      prisma.deposit.findMany({
        where: {
          userId: user.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 25,
        select: {
          id: true,
          amount: true,
          reference: true,
          proofUrl: true,
          status: true,
          note: true,
          createdAt: true,
          processedAt: true,
        },
      }),

      prisma.withdrawal.findMany({
        where: {
          userId: user.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 25,
        select: {
          id: true,
          amount: true,
          method: true,
          accountDetails: true,
          reference: true,
          status: true,
          note: true,
          createdAt: true,
          processedAt: true,
        },
      }),

      prisma.platformSetting.findFirst({
        select: { depositInstructions: true },
      }),
    ])

    const availableBalance = user.wallet
      ? user.wallet.balance.sub(user.wallet.reservedBalance).toString()
      : '0.00'

    return NextResponse.json({
      user: { ...customerUser, hasPaymentPassword: Boolean(paymentPasswordHash) },
      availableBalance,
      transactions,
      deposits,
      withdrawals,
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
