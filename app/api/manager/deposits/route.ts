import { NextResponse } from 'next/server'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import {
  handleRequestSecurityError,
  readJson,
  requireSameOrigin,
} from '@/lib/security'

function validAmount(value: unknown) {
  try {
    const amount = new Decimal(String(value))
    return amount.isFinite() && amount.gt(0) && amount.decimalPlaces() <= 2 ? amount : null
  } catch { return null }
}

export async function POST(req: Request) {
  try {
    requireSameOrigin(req)

    const session = await getSession()

    if (
      !session ||
      session.role !== 'MANAGER' ||
      !session.managerId
    ) {
      return NextResponse.json(
        { error: 'Unauthorized.' },
        { status: 401 },
      )
    }

    const manager = await prisma.manager.findUnique({
      where: {
        id: session.managerId,
      },
      select: {
        id: true,
        status: true,
      },
    })

    if (!manager || manager.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Manager account is not active.' },
        { status: 403 },
      )
    }

    const body = await readJson<{
      id?: unknown
      action?: unknown
      note?: unknown
    }>(req)

    const id = String(body.id || '').trim()
    const action = String(body.action || '')
      .trim()
      .toUpperCase()

    const note = String(body.note || '')
      .trim()
      .slice(0, 1000)

    if (
      !id ||
      id.length > 100 ||
      !['APPROVE', 'REJECT'].includes(action)
    ) {
      return NextResponse.json(
        { error: 'Invalid request.' },
        { status: 400 },
      )
    }

    try {
      await prisma.$transaction(
        async (tx) => {
          /*
           * Ownership is checked at BOTH levels:
           *
           * Deposit.managerId === logged-in manager
           * User.managerId === logged-in manager
           *
           * This prevents cross-manager access even if a manipulated
           * deposit ID is supplied.
           */
          const deposit = await tx.deposit.findFirst({
            where: {
              id,
              managerId: session.managerId!,
              status: 'PENDING',
            },
            include: {
              user: {
                select: {
                  id: true,
                  managerId: true,
                  status: true,
                },
              },
            },
          })

          if (!deposit) {
            throw new Error('NOT_PENDING')
          }

          if (deposit.user.managerId !== session.managerId) {
            throw new Error('OWNERSHIP_MISMATCH')
          }

          if (deposit.user.status !== 'ACTIVE') {
            throw new Error('USER_INACTIVE')
          }

          const processedAt = new Date()

          const claimed = await tx.deposit.updateMany({
            where: {
              id: deposit.id,
              managerId: session.managerId!,
              status: 'PENDING',
            },
            data: {
              status:
                action === 'APPROVE'
                  ? 'APPROVED'
                  : 'REJECTED',
              note:
                note ||
                (action === 'APPROVE'
                  ? null
                  : 'Deposit rejected.'),
              processedAt,
            },
          })

          if (claimed.count !== 1) {
            throw new Error('NOT_PENDING')
          }

          if (action === 'APPROVE') {
            const amount = validAmount(deposit.amount)

            if (amount === null) {
              throw new Error('INVALID_AMOUNT')
            }

            const wallet = await tx.wallet.upsert({
              where: {
                userId: deposit.userId,
              },
              create: {
                userId: deposit.userId,
                balance: deposit.amount,
                reservedBalance: 0,
              },
              update: {
                balance: {
                  increment: deposit.amount,
                },
              },
            })

            const balanceBefore =
              wallet.balance.sub(deposit.amount)

            const balanceAfter = wallet.balance

            await tx.transaction.create({
              data: {
                userId: deposit.userId,
                managerId: session.managerId!,
                type: 'DEPOSIT',
                amount: deposit.amount,
                balanceBefore,
                balanceAfter,
                reference: deposit.reference,
                note:
                  note || 'Manual deposit approved',
              },
            })

            await tx.notification.create({
              data: {
                userId: deposit.userId,
                type: 'WALLET',
                title: 'Deposit approved',
                message: `Your deposit of INR ${amount.toFixed(2)} has been approved and added to your wallet.`,
              },
            })

            await tx.auditLog.create({
              data: {
                actorType: 'MANAGER',
                actorId: session.sub,
                managerId: session.managerId!,
                action: 'DEPOSIT_APPROVED',
                targetType: 'DEPOSIT',
                targetId: deposit.id,
                amount: deposit.amount,
                metadata: {
                  userId: deposit.userId,
                  note,
                },
              },
            })
          } else {
            await tx.notification.create({
              data: {
                userId: deposit.userId,
                type: 'WALLET',
                title: 'Deposit rejected',
                message:
                  note ||
                  `Your deposit request of INR ${deposit.amount.toFixed(2)} was rejected by your manager.`,
              },
            })

            await tx.auditLog.create({
              data: {
                actorType: 'MANAGER',
                actorId: session.sub,
                managerId: session.managerId!,
                action: 'DEPOSIT_REJECTED',
                targetType: 'DEPOSIT',
                targetId: deposit.id,
                amount: deposit.amount,
                metadata: {
                  userId: deposit.userId,
                  note,
                },
              },
            })
          }
        },
        {
          isolationLevel: 'Serializable',
        },
      )
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'NOT_PENDING'
      ) {
        return NextResponse.json(
          {
            error:
              'Deposit not found or already processed.',
          },
          { status: 409 },
        )
      }

      if (
        error instanceof Error &&
        error.message === 'OWNERSHIP_MISMATCH'
      ) {
        return NextResponse.json(
          {
            error:
              'This deposit does not belong to your client.',
          },
          { status: 403 },
        )
      }

      if (
        error instanceof Error &&
        error.message === 'USER_INACTIVE'
      ) {
        return NextResponse.json(
          {
            error:
              'This client account is not active.',
          },
          { status: 403 },
        )
      }

      if (
        error instanceof Error &&
        error.message === 'INVALID_AMOUNT'
      ) {
        return NextResponse.json(
          {
            error: 'Deposit amount is invalid.',
          },
          { status: 400 },
        )
      }

      throw error
    }

    return NextResponse.json({
      ok: true,
      message:
        action === 'APPROVE'
          ? 'Deposit approved successfully.'
          : 'Deposit rejected successfully.',
    })
  } catch (error) {
    const securityResponse =
      handleRequestSecurityError(error)

    if (securityResponse) {
      return securityResponse
    }

    console.error(
      'MANAGER_DEPOSIT_ACTION_ERROR',
      error,
    )

    return NextResponse.json(
      {
        error:
          'Unable to process deposit request.',
      },
      { status: 500 },
    )
  }
}
