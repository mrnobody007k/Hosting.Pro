import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import {
  handleRequestSecurityError,
  readJson,
  requireSameOrigin,
} from '@/lib/security'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'MANAGER' || !session.managerId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    const cursor = new URL(request.url).searchParams.get('cursor')
    if (cursor && (cursor.length > 100 || !(await prisma.withdrawal.findFirst({ where: { id: cursor, managerId: session.managerId }, select: { id: true } })))) return NextResponse.json({ error: 'Invalid withdrawal page cursor.' }, { status: 400 })
    const [manager, rows] = await Promise.all([
      prisma.manager.findUnique({ where: { id: session.managerId }, select: { name: true } }),
      prisma.withdrawal.findMany({ where: { managerId: session.managerId, status: { in: ['PENDING', 'APPROVED'] }, user: { managerId: session.managerId } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), take: 26, select: { id: true, amount: true, method: true, accountDetails: true, reference: true, status: true, createdAt: true, user: { select: { name: true, email: true } } } }),
    ])
    const hasMore = rows.length > 25
    const withdrawals = rows.slice(0, 25).map((row) => ({ ...row, amount: row.amount.toString() }))
    return NextResponse.json({ manager, withdrawals, nextCursor: hasMore ? withdrawals.at(-1)?.id || null : null })
  } catch (error) {
    console.error('MANAGER_WITHDRAWALS_GET_ERROR', error)
    return NextResponse.json({ error: 'Unable to load withdrawal requests.' }, { status: 500 })
  }
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
      reference?: unknown
      note?: unknown
    }>(req)

    const id = String(body.id || '').trim()
    const action = String(body.action || '').trim()
    const reference = String(body.reference || '')
      .trim()
      .slice(0, 300)
    const note = String(body.note || '')
      .trim()
      .slice(0, 1000)

    if (
      !id ||
      id.length > 100 ||
      !['APPROVE', 'REJECT', 'PAID'].includes(action)
    ) {
      return NextResponse.json(
        { error: 'Invalid request.' },
        { status: 400 },
      )
    }

    const result = await prisma.$transaction(
      async (tx) => {
        /*
         * IMPORTANT OWNERSHIP CHAIN:
         *
         * MANAGER
         *   -> WITHDRAWAL.managerId
         *   -> USER.managerId
         *
         * The request must satisfy all three.
         */
        const withdrawal =
          await tx.withdrawal.findFirst({
            where: {
              id,
              managerId: session.managerId,
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

        if (!withdrawal) {
          throw new Error('NOT_FOUND')
        }

        if (
          withdrawal.user.managerId !==
          session.managerId
        ) {
          throw new Error('OWNERSHIP_MISMATCH')
        }

        if (withdrawal.user.status !== 'ACTIVE') {
          throw new Error('USER_INACTIVE')
        }

        /*
         * REJECT
         */
        if (action === 'REJECT') {
          if (withdrawal.status !== 'PENDING') {
            throw new Error('INVALID_TRANSITION')
          }

          const changed =
            await tx.withdrawal.updateMany({
              where: {
                id,
                managerId: session.managerId,
                status: 'PENDING',
              },
              data: {
                status: 'REJECTED',
                note:
                  note ||
                  'Withdrawal rejected.',
                processedAt: new Date(),
              },
            })

          if (changed.count !== 1) {
            throw new Error('INVALID_TRANSITION')
          }

          const wallet =
            await tx.wallet.findUnique({
              where: {
                userId: withdrawal.userId,
              },
              select: {
                balance: true,
                reservedBalance: true,
              },
            })

          if (
            !wallet ||
            wallet.reservedBalance.lt(
              withdrawal.amount,
            )
          ) {
            throw new Error(
              'INVALID_RESERVATION',
            )
          }

          await tx.wallet.update({
            where: {
              userId: withdrawal.userId,
            },
            data: {
              reservedBalance: {
                decrement:
                  withdrawal.amount,
              },
            },
          })

          await tx.notification.create({
            data: {
              userId: withdrawal.userId,
              type: 'WARNING',
              title: 'Withdrawal rejected',
              message:
                note ||
                'Your withdrawal request was rejected by your manager.',
            },
          })

          await tx.auditLog.create({
            data: {
              actorType: 'MANAGER',
              actorId: session.sub,
              managerId: session.managerId,
              action: 'WITHDRAWAL_REJECTED',
              targetType: 'WITHDRAWAL',
              targetId: id,
              amount: withdrawal.amount,
              metadata: {
                userId:
                  withdrawal.userId,
                note,
              },
            },
          })

          return {
            status: 'REJECTED',
          }
        }

        /*
         * APPROVE
         */
        if (action === 'APPROVE') {
          if (withdrawal.status !== 'PENDING') {
            throw new Error('INVALID_TRANSITION')
          }

          const changed =
            await tx.withdrawal.updateMany({
              where: {
                id,
                managerId: session.managerId,
                status: 'PENDING',
              },
              data: {
                status: 'APPROVED',
                note: note || null,
              },
            })

          if (changed.count !== 1) {
            throw new Error('INVALID_TRANSITION')
          }

          await tx.notification.create({
            data: {
              userId: withdrawal.userId,
              type: 'SUCCESS',
              title: 'Withdrawal approved',
              message:
                'Your withdrawal request has been approved and is being processed.',
            },
          })

          await tx.auditLog.create({
            data: {
              actorType: 'MANAGER',
              actorId: session.sub,
              managerId: session.managerId,
              action: 'WITHDRAWAL_APPROVED',
              targetType: 'WITHDRAWAL',
              targetId: id,
              amount: withdrawal.amount,
              metadata: {
                userId:
                  withdrawal.userId,
                note,
              },
            },
          })

          return {
            status: 'APPROVED',
          }
        }

        /*
         * PAID
         */
        if (withdrawal.status !== 'APPROVED') {
          throw new Error('INVALID_TRANSITION')
        }

        if (!reference) {
          throw new Error('REFERENCE_REQUIRED')
        }

        const wallet =
          await tx.wallet.findUnique({
            where: {
              userId: withdrawal.userId,
            },
            select: {
              balance: true,
              reservedBalance: true,
            },
          })

        if (
          !wallet ||
          wallet.reservedBalance.lt(
            withdrawal.amount,
          ) ||
          wallet.balance.lt(
            withdrawal.amount,
          )
        ) {
          throw new Error(
            'INVALID_RESERVATION',
          )
        }

        /*
         * Atomic status claim prevents two
         * concurrent PAID requests from both
         * deducting the wallet.
         */
        const changed =
          await tx.withdrawal.updateMany({
            where: {
              id,
              managerId: session.managerId,
              status: 'APPROVED',
            },
            data: {
              status: 'PAID',
              reference,
              note: note || null,
              processedAt: new Date(),
            },
          })

        if (changed.count !== 1) {
          throw new Error('INVALID_TRANSITION')
        }

        const updatedWallet =
          await tx.wallet.update({
            where: {
              userId: withdrawal.userId,
            },
            data: {
              balance: {
                decrement:
                  withdrawal.amount,
              },
              reservedBalance: {
                decrement:
                  withdrawal.amount,
              },
            },
            select: {
              balance: true,
              reservedBalance: true,
            },
          })

        await tx.transaction.create({
          data: {
            userId: withdrawal.userId,
            managerId: session.managerId,
            type: 'WITHDRAWAL',
            amount: withdrawal.amount,
            balanceBefore: wallet.balance,
            balanceAfter:
              updatedWallet.balance,
            reference,
            note:
              note ||
              'Manual withdrawal paid',
          },
        })

        await tx.notification.create({
          data: {
            userId: withdrawal.userId,
            type: 'SUCCESS',
            title: 'Withdrawal paid',
            message:
              'Your withdrawal has been marked as paid by your manager.',
          },
        })

        await tx.auditLog.create({
          data: {
            actorType: 'MANAGER',
            actorId: session.sub,
            managerId: session.managerId,
            action: 'WITHDRAWAL_PAID',
            targetType: 'WITHDRAWAL',
            targetId: id,
            amount: withdrawal.amount,
            metadata: {
              userId:
                withdrawal.userId,
              reference,
              note,
            },
          },
        })

        return {
          status: 'PAID',
        }
      },
      {
        isolationLevel: 'Serializable',
      },
    )

    return NextResponse.json({
      ok: true,
      status: result.status,
    })
  } catch (error) {
    const securityResponse =
      handleRequestSecurityError(error)

    if (securityResponse) {
      return securityResponse
    }

    if (
      error instanceof Error &&
      error.message === 'NOT_FOUND'
    ) {
      return NextResponse.json(
        { error: 'Withdrawal not found.' },
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
            'This withdrawal is not associated with your manager account.',
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
            'The client account is not currently active.',
        },
        { status: 403 },
      )
    }

    if (
      error instanceof Error &&
      error.message ===
        'INVALID_TRANSITION'
    ) {
      return NextResponse.json(
        {
          error:
            'This withdrawal was already processed or is no longer in the expected status.',
        },
        { status: 409 },
      )
    }

    if (
      error instanceof Error &&
      error.message ===
        'REFERENCE_REQUIRED'
    ) {
      return NextResponse.json(
        {
          error:
            'Payment reference is required before marking paid.',
        },
        { status: 400 },
      )
    }

    if (
      error instanceof Error &&
      error.message ===
        'INVALID_RESERVATION'
    ) {
      return NextResponse.json(
        {
          error:
            'Withdrawal balance reservation is no longer valid. Please review the client balance.',
        },
        { status: 400 },
      )
    }

    console.error(
      'MANAGER_WITHDRAWAL_ERROR',
      error,
    )

    return NextResponse.json(
      {
        error:
          'Unable to process withdrawal. Please try again.',
      },
      { status: 500 },
    )
  }
}
