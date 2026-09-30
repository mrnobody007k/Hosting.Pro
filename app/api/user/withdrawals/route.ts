import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import {
  handleRequestSecurityError,
  readJson,
  requireSameOrigin,
  validMoney,
} from '@/lib/security'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'USER' || !session.managerId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    const user = await prisma.user.findFirst({ where: { id: session.sub, managerId: session.managerId, status: 'ACTIVE', signupStatus: 'APPROVED', manager: { status: 'ACTIVE' } }, select: { id: true } })
    if (!user) return NextResponse.json({ error: 'Your account is not available.' }, { status: 403 })
    const cursor = new URL(request.url).searchParams.get('cursor')
    if (cursor && (cursor.length > 100 || !(await prisma.withdrawal.findFirst({ where: { id: cursor, userId: user.id, managerId: session.managerId }, select: { id: true } })))) {
      return NextResponse.json({ error: 'Invalid withdrawal page cursor.' }, { status: 400 })
    }
    const withdrawals = await prisma.withdrawal.findMany({
      where: { userId: user.id, managerId: session.managerId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), take: 25,
      select: { id: true, amount: true, method: true, accountDetails: true, reference: true, status: true, note: true, createdAt: true, processedAt: true },
    })
    return NextResponse.json({ withdrawals: withdrawals.map((item) => ({ ...item, amount: item.amount.toString() })), nextCursor: withdrawals.length === 25 ? withdrawals[withdrawals.length - 1].id : null })
  } catch (error) {
    console.error('USER_WITHDRAWALS_GET_ERROR', error)
    return NextResponse.json({ error: 'Unable to load withdrawal history.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    requireSameOrigin(req)

    const session = await getSession()

    if (
      !session ||
      session.role !== 'USER' ||
      !session.managerId
    ) {
      return NextResponse.json(
        { error: 'Unauthorized.' },
        { status: 401 },
      )
    }

    const body = await readJson<{
      amount?: unknown
      method?: unknown
      accountDetails?: unknown
      paymentPassword?: unknown
    }>(req)

    const amount = validMoney(
      body?.amount,
    )

    const method = String(
      body?.method || '',
    )
      .trim()
      .slice(0, 100)

    const accountDetails = String(
      body?.accountDetails || '',
    )
      .trim()
      .slice(0, 2000)

    const paymentPassword = typeof body?.paymentPassword === 'string'
      ? body.paymentPassword
      : ''

    if (
      amount === null ||
      !method ||
      !accountDetails ||
      paymentPassword.length < 6 ||
      paymentPassword.length > 200
    ) {
      return NextResponse.json(
        {
          error:
            'Enter a valid amount, payout method, account details and payment password.',
        },
        { status: 400 },
      )
    }

    const paymentAccount = await prisma.user.findFirst({
      where: { id: session.sub, managerId: session.managerId, status: 'ACTIVE', signupStatus: 'APPROVED' },
      select: { paymentPasswordHash: true },
    })
    if (!paymentAccount) {
      return NextResponse.json({ error: 'Your account is not currently active.' }, { status: 403 })
    }
    if (!paymentAccount.paymentPasswordHash) {
      return NextResponse.json({ error: 'Set a payment password in Settings before requesting a payout.' }, { status: 409 })
    }
    if (!(await bcrypt.compare(paymentPassword, paymentAccount.paymentPasswordHash))) {
      return NextResponse.json({ error: 'Payment password is incorrect.' }, { status: 403 })
    }

    const result =
      await prisma.$transaction(
        async (tx) => {
          /*
           * User is identified ONLY from the
           * authenticated session.
           */
          const user =
            await tx.user.findUnique({
              where: {
                id: session.sub,
              },
              select: {
                id: true,
                managerId: true,
                status: true,
                paymentPasswordHash: true,
                signupStatus: true,
                manager: {
                  select: {
                    id: true,
                    status: true,
                  },
                },
              },
            })

          if (!user) {
            throw new Error(
              'USER_NOT_FOUND',
            )
          }

          /*
           * The authenticated user's manager must
           * match the manager embedded in the session.
           */
          if (
            user.managerId !==
            session.managerId
          ) {
            throw new Error(
              'OWNERSHIP_MISMATCH',
            )
          }

          if (user.paymentPasswordHash !== paymentAccount.paymentPasswordHash) {
            throw new Error('PAYMENT_PASSWORD_CHANGED')
          }

          if (
            user.status !== 'ACTIVE' ||
            user.signupStatus !== 'APPROVED' ||
            user.manager.status !==
              'ACTIVE'
          ) {
            throw new Error(
              'ACCOUNT_INACTIVE',
            )
          }

          /*
           * Wallet is owned exclusively by this user.
           */
          const wallet =
            await tx.wallet.findUnique({
              where: {
                userId: user.id,
              },
              select: {
                userId: true,
                balance: true,
                reservedBalance: true,
              },
            })

          if (!wallet) {
            throw new Error(
              'WALLET_NOT_FOUND',
            )
          }

          /*
           * Use Decimal arithmetic.
           * Do NOT convert financial values to JS Number.
           */
          const availableBalance =
            wallet.balance.sub(
              wallet.reservedBalance,
            )

          if (
            availableBalance.lt(amount)
          ) {
            throw new Error(
              'INSUFFICIENT_AVAILABLE_BALANCE',
            )
          }

          /*
           * Reserve funds atomically before creating
           * the withdrawal request.
           */
          const reserved =
            await tx.wallet.updateMany({
              where: {
                userId: user.id,
              },
              data: {
                reservedBalance: {
                  increment: amount,
                },
              },
            })

          if (
            reserved.count !== 1
          ) {
            throw new Error(
              'WALLET_UPDATE_FAILED',
            )
          }

          const withdrawal =
            await tx.withdrawal.create({
              data: {
                userId: user.id,
                managerId:
                  session.managerId,
                amount,
                method,
                accountDetails,
                status: 'PENDING',
              },
            })

          await tx.auditLog.create({
            data: {
              actorType: 'USER',
              actorId: user.id,
              managerId:
                session.managerId,
              action:
                'WITHDRAWAL_REQUESTED',
              targetType: 'WITHDRAWAL',
              targetId:
                withdrawal.id,
              amount,
              metadata: {
                method,
                userId: user.id,
                managerId:
                  session.managerId,
              },
            },
          })

          return {
            id: withdrawal.id,
            status:
              withdrawal.status,
            amount:
              withdrawal.amount,
          }
        },
        {
          isolationLevel:
            'Serializable',
        },
      )

    return NextResponse.json({
      ok: true,
      id: result.id,
      status: result.status,
      amount: result.amount.toString(),
    })
  } catch (error) {
    const securityError =
      handleRequestSecurityError(
        error,
      )

    if (securityError) {
      return securityError
    }

    if (
      error instanceof Error &&
      error.message ===
        'USER_NOT_FOUND'
    ) {
      return NextResponse.json(
        {
          error:
            'User not found.',
        },
        { status: 404 },
      )
    }

    if (
      error instanceof Error &&
      error.message ===
        'OWNERSHIP_MISMATCH'
    ) {
      return NextResponse.json(
        {
          error:
            'Your account ownership could not be verified.',
        },
        { status: 403 },
      )
    }

    if (
      error instanceof Error &&
      error.message ===
        'ACCOUNT_INACTIVE'
    ) {
      return NextResponse.json(
        {
          error:
            'Your account is not currently active.',
        },
        { status: 403 },
      )
    }

    if (error instanceof Error && error.message === 'PAYMENT_PASSWORD_CHANGED') {
      return NextResponse.json({ error: 'Your payment password changed. Try again.' }, { status: 409 })
    }

    if (
      error instanceof Error &&
      error.message ===
        'WALLET_NOT_FOUND'
    ) {
      return NextResponse.json(
        {
          error:
            'Your wallet could not be found.',
        },
        { status: 500 },
      )
    }

    if (
      error instanceof Error &&
      error.message ===
        'INSUFFICIENT_AVAILABLE_BALANCE'
    ) {
      return NextResponse.json(
        {
          error:
            'Withdrawal exceeds your available balance.',
        },
        { status: 400 },
      )
    }

    if (
      error instanceof Error &&
      error.message ===
        'WALLET_UPDATE_FAILED'
    ) {
      return NextResponse.json(
        {
          error:
            'Unable to reserve withdrawal balance.',
        },
        { status: 409 },
      )
    }

    console.error(
      'USER_WITHDRAWAL_ERROR',
      error,
    )

    return NextResponse.json(
      {
        error:
          'Unable to create withdrawal request. Please try again.',
      },
      { status: 500 },
    )
  }
}
