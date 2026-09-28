import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { readJson, requireSameOrigin, handleRequestSecurityError } from '@/lib/security'

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

    const body = await readJson<{ orderId?: unknown }>(req)

    const orderId = String(body?.orderId || '').trim()

    if (!orderId || orderId.length > 100) {
      return NextResponse.json(
        { error: 'A valid order is required.' },
        { status: 400 },
      )
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: session.sub,
        managerId: session.managerId,
        status: 'ACTIVE',
        paymentStatus: 'PAID',
        paymentVerifiedAt: { not: null },
      },
      include: {
        property: { select: { id: true, title: true, managerId: true } },
        user: { select: { status: true, signupStatus: true, manager: { select: { status: true } } } },
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found or not eligible for Re-Rent.' },
        { status: 404 },
      )
    }

    if (
      order.property?.managerId &&
      order.property.managerId !== session.managerId
    ) {
      return NextResponse.json(
        { error: 'This order is not available for Re-Rent.' },
        { status: 403 },
      )
    }

    if (
      order.user.status !== 'ACTIVE' ||
      order.user.signupStatus !== 'APPROVED' ||
      order.user.manager.status !== 'ACTIVE'
    ) {
      return NextResponse.json(
        { error: 'Your account is not currently active.' },
        { status: 403 },
      )
    }

    const existingTask = await prisma.task.findFirst({
      where: {
        orderId: order.id,
        type: 'RE_RENT',
        userId: session.sub,
        managerId: session.managerId,
      },
      select: { id: true, status: true },
    })

    if (existingTask) {
      return NextResponse.json(
        { error: 'A Re-Rent request already exists for this order.' },
        { status: 409 },
      )
    }

    const setting = await prisma.platformSetting.findFirst({
      select: { rerentProfitRate: true, rerentDelaySeconds: true },
    })

    const rerentProfitRate = setting?.rerentProfitRate?.toString() || '1.20'
    const rerentDelaySeconds = Number(setting?.rerentDelaySeconds ?? 90)

    const created = await prisma.$transaction(
      async (tx) => {
        const task = await tx.task.create({
          data: {
            userId: session.sub,
            managerId: session.managerId!,
            orderId: order.id,
            type: 'RE_RENT',
            title: 'Re-Rent Request',
            description: `Request to re-rent ${order.property?.title || 'property'} (Order ${order.orderCode})`,
            dayNumber: 0,
            profitRate: rerentProfitRate,
            profitAmount: 0,
            status: 'PENDING',
          },
        })

        await tx.order.update({
          where: { id: order.id },
          data: { status: 'RE_RENT_PENDING', rerentRequestedAt: new Date() },
        })

        await tx.notification.create({
          data: {
            userId: session.sub,
            type: 'TASK',
            title: 'Re-Rent request submitted',
            message: `Your Re-Rent request for order ${order.orderCode} has been received. Processing will complete automatically.`,
          },
        })

        await tx.auditLog.create({
          data: {
            actorType: 'USER',
            actorId: session.sub,
            managerId: session.managerId,
            action: 'RERENT_REQUEST_CREATED',
            targetType: 'TASK',
            targetId: task.id,
            metadata: { orderCode: order.orderCode, orderId: order.id, propertyId: order.property?.id },
          },
        })

        return task
      },
      { isolationLevel: 'Serializable' },
    )

    return NextResponse.json({
      message: 'Re-Rent request submitted successfully.',
      task: created,
      processingSeconds: rerentDelaySeconds,
    })
  } catch (error) {
    const securityResponse = handleRequestSecurityError(error)
    if (securityResponse) return securityResponse

    console.error('USER_RERENT_REQUEST_ERROR', error)
    return NextResponse.json({ error: 'Unable to submit Re-Rent request.' }, { status: 500 })
  }
}