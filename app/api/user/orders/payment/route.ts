import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import {
  readJson,
  isValidHttpsUrl,
  requireSameOrigin,
  handleRequestSecurityError,
} from '@/lib/security'

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
      orderId?: unknown
      paymentReference?: unknown
      paymentProofUrl?: unknown
    }>(req)

    const orderId = String(
      body.orderId || '',
    ).trim()

    const paymentReference = String(
      body.paymentReference || '',
    ).trim()

    const paymentProofUrl = String(
      body.paymentProofUrl || '',
    ).trim()

    if (
      !orderId ||
      orderId.length > 100
    ) {
      return NextResponse.json(
        {
          error:
            'Valid order ID is required.',
        },
        { status: 400 },
      )
    }

    if (
      !paymentReference &&
      !paymentProofUrl
    ) {
      return NextResponse.json(
        {
          error:
            'Payment reference or payment proof is required.',
        },
        { status: 400 },
      )
    }

    if (
      paymentReference.length > 200
    ) {
      return NextResponse.json(
        {
          error:
            'Payment reference is too long.',
        },
        { status: 400 },
      )
    }

    if (
      paymentProofUrl.length > 1000
    ) {
      return NextResponse.json(
        {
          error:
            'Payment proof reference is too long.',
        },
        { status: 400 },
      )
    }
    if (paymentProofUrl && !isValidHttpsUrl(paymentProofUrl)) {
      return NextResponse.json(
        { error: 'Payment proof must be a secure HTTPS link.' },
        { status: 400 },
      )
    }

    /*
     * Full ownership chain:
     *
     * USER session
     *   -> ORDER.userId
     *   -> ORDER.managerId
     *
     * The manager ID is NEVER accepted from the
     * request body.
     */
    const order =
      await prisma.order.findFirst({
        where: {
          id: orderId,
          userId: session.sub,
          managerId: session.managerId,
        },
        select: {
          id: true,
          orderCode: true,
          userId: true,
          managerId: true,
          status: true,
          paymentStatus: true,
          user: { select: { id: true, managerId: true, status: true, signupStatus: true, manager: { select: { status: true } } } },
        },
      })

    if (!order) {
      return NextResponse.json(
        {
          error:
            'Order not found.',
        },
        { status: 404 },
      )
    }

    if (
      order.userId !== session.sub ||
      order.managerId !== session.managerId ||
      order.user.managerId !== session.managerId ||
      order.user.status !== 'ACTIVE' ||
      order.user.signupStatus !== 'APPROVED' ||
      order.user.manager.status !== 'ACTIVE'
    ) {
      return NextResponse.json(
        {
          error:
            'This order is not associated with your account.',
        },
        { status: 403 },
      )
    }

    if (
      order.status !==
        'PAYMENT_PENDING' &&
      order.status !==
        'PAYMENT_SUBMITTED'
    ) {
      return NextResponse.json(
        {
          error:
            'This order is not awaiting payment submission.',
        },
        { status: 400 },
      )
    }

    const now = new Date()

    const updated =
      await prisma.$transaction(
        async (tx) => {
          /*
           * Re-check ownership and state inside
           * the transaction to prevent ID manipulation
           * and race conditions.
           */
          const current =
            await tx.order.findFirst({
              where: {
                id: order.id,
                userId: session.sub,
                managerId:
                  session.managerId,
              },
              select: {
                id: true,
                orderCode: true,
                userId: true,
                managerId: true,
                status: true,
                paymentStatus: true,
                paymentReference: true,
                paymentProofUrl: true,
                user: { select: { managerId: true, status: true, signupStatus: true, manager: { select: { status: true } } } },
              },
            })

          if (!current) {
            throw new Error(
              'ORDER_NOT_FOUND',
            )
          }

          if (
            current.userId !==
              session.sub ||
            current.managerId !==
              session.managerId ||
            current.user.managerId !== session.managerId ||
            current.user.status !== 'ACTIVE' ||
            current.user.signupStatus !== 'APPROVED' ||
            current.user.manager.status !== 'ACTIVE'
          ) {
            throw new Error(
              'OWNERSHIP_MISMATCH',
            )
          }

          if (
            current.status !==
              'PAYMENT_PENDING' &&
            current.status !==
              'PAYMENT_SUBMITTED'
          ) {
            throw new Error(
              'ORDER_ALREADY_PROCESSED',
            )
          }

          /*
           * Atomic state transition.
           *
           * Only this user's order belonging to
           * this manager can be changed.
           */
          const changed =
            await tx.order.updateMany({
              where: {
                id: current.id,
                userId: session.sub,
                managerId:
                  session.managerId,
                status: {
                  in: [
                    'PAYMENT_PENDING',
                    'PAYMENT_SUBMITTED',
                  ],
                },
                paymentStatus: 'PENDING',
              },
              data: {
                status:
                  'PAYMENT_SUBMITTED',
                paymentStatus:
                  'PENDING',
                paymentReference:
                  paymentReference ||
                  current.paymentReference,
                paymentProofUrl:
                  paymentProofUrl ||
                  current.paymentProofUrl,
                paymentSubmittedAt:
                  now,
              },
            })

          if (
            changed.count !== 1
          ) {
            throw new Error(
              'ORDER_ALREADY_PROCESSED',
            )
          }

          await tx.notification.create({
            data: {
              userId: session.sub,
              type: 'ORDER',
              title:
                'Payment submitted',
              message:
                `Payment details for order ${current.orderCode} were submitted and are being reviewed.`,
            },
          })

          await tx.auditLog.create({
            data: {
              actorType: 'USER',
              actorId: session.sub,
              managerId:
                session.managerId,
              action:
                'ORDER_PAYMENT_SUBMITTED',
              targetType: 'ORDER',
              targetId: current.id,
              metadata: {
                orderCode:
                  current.orderCode,
                paymentReference:
                  paymentReference ||
                  null,
                paymentProofUrl:
                  paymentProofUrl ||
                  null,
                userId:
                  session.sub,
                managerId:
                  session.managerId,
              },
            },
          })

          return {
            id: current.id,
            orderCode:
              current.orderCode,
            status:
              'PAYMENT_SUBMITTED' as const,
            paymentStatus:
              'PENDING' as const,
            paymentSubmittedAt:
              now,
          }
        },
        {
          isolationLevel:
            'Serializable',
        },
      )

    return NextResponse.json({
      message:
        'Payment details submitted successfully. They are being reviewed.',
      order: updated,
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
      error instanceof Error &&
      error.message ===
        'ORDER_NOT_FOUND'
    ) {
      return NextResponse.json(
        {
          error:
            'Order no longer exists.',
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
            'This order is not associated with your account.',
        },
        { status: 403 },
      )
    }

    if (
      error instanceof Error &&
      error.message ===
        'ORDER_ALREADY_PROCESSED'
    ) {
      return NextResponse.json(
        {
          error:
            'This order has already been processed.',
        },
        { status: 409 },
      )
    }

    console.error(
      'USER_PAYMENT_SUBMIT_ERROR',
      error,
    )

    return NextResponse.json(
      {
        error:
          'Unable to submit payment details.',
      },
      { status: 500 },
    )
  }
}
