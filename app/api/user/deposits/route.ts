import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import {
  handleRequestSecurityError,
  isValidHttpsUrl,
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
    if (cursor && (cursor.length > 100 || !(await prisma.deposit.findFirst({ where: { id: cursor, userId: user.id, managerId: session.managerId }, select: { id: true } })))) {
      return NextResponse.json({ error: 'Invalid deposit page cursor.' }, { status: 400 })
    }
    const deposits = await prisma.deposit.findMany({
      where: { userId: user.id, managerId: session.managerId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), take: 25,
      select: { id: true, amount: true, reference: true, proofUrl: true, status: true, note: true, createdAt: true, processedAt: true },
    })
    return NextResponse.json({ deposits: deposits.map((deposit) => ({ ...deposit, amount: deposit.amount.toString() })), nextCursor: deposits.length === 25 ? deposits[deposits.length - 1].id : null })
  } catch (error) {
    console.error('USER_DEPOSITS_GET_ERROR', error)
    return NextResponse.json({ error: 'Unable to load deposit history.' }, { status: 500 })
  }
}

export async function POST(
  req: Request,
) {
  try {
    requireSameOrigin(req)

    const session =
      await getSession()

    if (
      !session ||
      session.role !== 'USER' ||
      !session.managerId
    ) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
        },
        { status: 401 },
      )
    }

    const body =
      await readJson<{
        amount?: unknown
        reference?: unknown
        proofUrl?: unknown
      }>(req)

    const amount =
      validMoney(body?.amount)

    const reference =
      String(
        body?.reference || '',
      )
        .trim()
        .slice(0, 300)

    const proofUrl =
      String(
        body?.proofUrl || '',
      )
        .trim()
        .slice(0, 1000)

    if (amount === null) {
      return NextResponse.json(
        {
          error:
            'Enter a valid positive amount.',
        },
        { status: 400 },
      )
    }

    if (!reference && !proofUrl) {
      return NextResponse.json(
        { error: 'A payment reference or proof link is required.' },
        { status: 400 },
      )
    }
    if (proofUrl && !isValidHttpsUrl(proofUrl)) {
      return NextResponse.json(
        { error: 'Payment proof must be a secure HTTPS link.' },
        { status: 400 },
      )
    }

    const result =
      await prisma.$transaction(
        async (tx) => {
          const user =
            await tx.user.findUnique({
              where: {
                id: session.sub,
              },
              select: {
                id: true,
                managerId: true,
                status: true,
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
           * LOCKED OWNERSHIP RULE:
           *
           * The authenticated user's managerId
           * must match both:
           * 1. session.managerId
           * 2. assigned manager relation
           */
          if (
            user.managerId !==
              session.managerId ||
            !user.manager ||
            user.manager.id !==
              session.managerId
          ) {
            throw new Error(
              'OWNERSHIP_MISMATCH',
            )
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

          const duplicateProofs = [
            ...(reference ? [{ reference }] : []),
            ...(proofUrl ? [{ proofUrl }] : []),
          ]
          const duplicate = await tx.deposit.findFirst({
            where: {
              userId: user.id,
              managerId: user.managerId,
              status: { in: ['PENDING', 'APPROVED'] },
              OR: duplicateProofs,
            },
            select: { id: true },
          })
          if (duplicate) throw new Error('DUPLICATE_DEPOSIT_PROOF')

          const deposit =
            await tx.deposit.create({
              data: {
                userId: user.id,
                managerId:
                  user.managerId,
                amount,
                reference:
                  reference || null,
                proofUrl:
                  proofUrl || null,
                status: 'PENDING',
              },
              select: {
                id: true,
                amount: true,
                status: true,
                createdAt: true,
              },
            })

          /*
           * Financial request and audit record
           * are committed together.
           */
          await tx.auditLog.create({
            data: {
              actorType: 'USER',
              actorId: user.id,
              managerId:
                user.managerId,
              action:
                'DEPOSIT_REQUESTED',
              targetType: 'DEPOSIT',
              targetId: deposit.id,
              amount,
              metadata: {
                reference:
                  reference || null,
              },
            },
          })

          return deposit
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
      amount: result.amount,
    })
  } catch (error) {
    const securityResponse =
      handleRequestSecurityError(
        error,
      )

    if (securityResponse) {
      return securityResponse
    }

    if (
      error instanceof Error
    ) {
      if (
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
        error.message ===
        'OWNERSHIP_MISMATCH'
      ) {
        return NextResponse.json(
          {
            error:
              'Unauthorized',
          },
          { status: 403 },
        )
      }

      if (
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
      if (error.message === 'DUPLICATE_DEPOSIT_PROOF') {
        return NextResponse.json(
          { error: 'This payment reference or proof is already attached to an open or approved deposit.' },
          { status: 409 },
        )
      }
    }

    console.error(
      'USER_DEPOSIT_ERROR',
      error,
    )

    return NextResponse.json(
      {
        error:
          'Unable to submit deposit request.',
      },
      { status: 500 },
    )
  }
}
