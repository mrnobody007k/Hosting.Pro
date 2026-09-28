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
