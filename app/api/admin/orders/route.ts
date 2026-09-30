import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requireAdminAuth } from "@/lib/admin-auth"
import { AdminPermission } from "@/lib/admin-permissions"

export async function GET(request: Request) {
  try {
    const auth = await requireAdminAuth(AdminPermission.MANAGE_ORDERS)
    if (!auth.ok) return auth.response
    const session = auth.session

    const params = new URL(request.url).searchParams
    const requestedLimit = Number(params.get('limit') || '100')
    const limit = Math.min(Math.max(Number.isInteger(requestedLimit) ? requestedLimit : 100, 1), 200)
    const cursor = params.get('cursor') || undefined
    if (cursor && cursor.length > 100) return NextResponse.json({ error: 'Invalid pagination cursor.' }, { status: 400 })
    const search = (params.get('search') || '').trim()
    const status = params.get('status') || 'ALL'
    const paymentStatus = params.get('paymentStatus') || 'ALL'
    const managerId = params.get('managerId') || 'ALL'
    const validOrderStatuses = ['PAYMENT_PENDING', 'PAYMENT_SUBMITTED', 'PAYMENT_VERIFIED', 'ACTIVE', 'RE_RENT_PENDING', 'RE_RENTED', 'COMPLETED', 'CANCELLED']
    if (search.length > 200 || (status !== 'ALL' && !validOrderStatuses.includes(status)) || (paymentStatus !== 'ALL' && !['PENDING', 'APPROVED', 'REJECTED', 'PAID'].includes(paymentStatus)) || (managerId !== 'ALL' && managerId.length > 100)) return NextResponse.json({ error: 'Invalid order filter.' }, { status: 400 })
    const where: Record<string, unknown> = {}
    if (status !== 'ALL') where.status = status
    if (paymentStatus !== 'ALL') where.paymentStatus = paymentStatus
    if (managerId !== 'ALL') where.managerId = managerId
    if (search) where.OR = [
      { orderCode: { contains: search, mode: 'insensitive' } },
      { user: { name: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
      { manager: { name: { contains: search, mode: 'insensitive' } } },
      { property: { title: { contains: search, mode: 'insensitive' } } },
    ]

    const orders = await prisma.order.findMany({
      where,
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : undefined,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            managerId: true,
            status: true,
            membershipStatus: true,
          },
        },
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
            referralCode: true,
            status: true,
          },
        },
        property: {
          select: {
            id: true,
            title: true,
            location: true,
            price: true,
            status: true,
          },
        },
        tasks: {
          take: 10,
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            type: true,
            title: true,
            description: true,
            dayNumber: true,
            profitRate: true,
            profitAmount: true,
            status: true,
            assignedAt: true,
            startedAt: true,
            submittedAt: true,
            completedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
        id: "asc",
      },
    });

    const hasMore = orders.length > limit
    if (hasMore) orders.pop()

    return NextResponse.json({
      orders: orders.map((order) => ({
        ...order,
        amount: order.amount.toString(),
        storehousePrice: order.storehousePrice.toString(),
        profit: order.profit.toString(),
        profitRate: order.profitRate.toString(),

        property: order.property
          ? {
              ...order.property,
              price: order.property.price.toString(),
            }
          : null,

        tasks: order.tasks.map((task) => ({
          ...task,
          profitRate: task.profitRate.toString(),
          profitAmount: task.profitAmount.toString(),
        })),
      })),
      nextCursor: hasMore ? orders[orders.length - 1]?.id ?? null : null,
    });
  } catch (error) {
    console.error("ADMIN_ORDERS_GET_ERROR", error);

    return NextResponse.json(
      { error: "Unable to load admin orders." },
      { status: 500 }
    );
  }
}
