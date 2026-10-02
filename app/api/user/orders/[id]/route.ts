import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'USER' || !session.managerId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    const { id } = await context.params
    const user = await prisma.user.findFirst({
      where: { id: session.sub, managerId: session.managerId, status: 'ACTIVE', signupStatus: 'APPROVED', manager: { status: 'ACTIVE' } },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: 'Your account is not available.' }, { status: 403 })

    const order = await prisma.order.findFirst({
      where: { id, userId: user.id, managerId: session.managerId },
      select: {
        id: true, orderCode: true, amount: true, profit: true, finalReturnAmount: true, profitRate: true, status: true, paymentStatus: true,
        paymentReference: true, paymentProofUrl: true, bookedAt: true, paymentSubmittedAt: true, paymentVerifiedAt: true, activatedAt: true,
        rerentRequestedAt: true, rerentedAt: true, completedAt: true, cancelledAt: true, createdAt: true, updatedAt: true,
        property: { select: { id: true, title: true, location: true, imageUrl: true } },
        tasks: { orderBy: { createdAt: 'asc' }, take: 10, select: { id: true, type: true, title: true, status: true, dayNumber: true, profitRate: true, profitAmount: true, assignedAt: true, submittedAt: true, completedAt: true, createdAt: true } },
      },
    })
    if (!order) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
    return NextResponse.json({ order: {
      ...order,
      amount: order.amount.toString(),
      profit: order.profit.toString(),
      finalReturnAmount: order.finalReturnAmount?.toString() ?? null,
      profitRate: order.profitRate.toString(),
      tasks: order.tasks.map((task) => ({ ...task, profitRate: task.profitRate.toString(), profitAmount: task.profitAmount.toString() })),
    } })
  } catch (error) {
    console.error('USER_ORDER_DETAIL_GET_ERROR', error)
    return NextResponse.json({ error: 'Unable to load this booking.' }, { status: 500 })
  }
}
