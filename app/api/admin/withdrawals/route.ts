import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requireAdminAuth } from "@/lib/admin-auth"
import { AdminPermission } from "@/lib/admin-permissions"

export async function GET(request: Request) {
  try {
    const auth = await requireAdminAuth(AdminPermission.MANAGE_WITHDRAWALS)
    if (!auth.ok) return auth.response
    const session = auth.session

    const params = new URL(request.url).searchParams
    const requestedLimit = Number(params.get('limit') || '100')
    const limit = Math.min(Math.max(Number.isInteger(requestedLimit) ? requestedLimit : 100, 1), 200)
    const cursor = params.get('cursor') || undefined
    if (cursor && cursor.length > 100) return NextResponse.json({ error: 'Invalid pagination cursor.' }, { status: 400 })
    const search = (params.get('search') || '').trim()
    const status = params.get('status') || 'ALL'
    const managerId = params.get('managerId') || 'ALL'
    if (search.length > 200 || (status !== 'ALL' && !['PENDING', 'APPROVED', 'REJECTED', 'PAID'].includes(status)) || (managerId !== 'ALL' && managerId.length > 100)) return NextResponse.json({ error: 'Invalid withdrawal filter.' }, { status: 400 })
    const where: Record<string, unknown> = {}
    if (status !== 'ALL') where.status = status
    if (managerId !== 'ALL') where.managerId = managerId
    if (search) where.OR = [
      { reference: { contains: search, mode: 'insensitive' } },
      { method: { contains: search, mode: 'insensitive' } },
      { user: { name: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
      { manager: { name: { contains: search, mode: 'insensitive' } } },
    ]

    const withdrawals = await prisma.withdrawal.findMany({
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
            signupStatus: true,
            membershipStatus: true,
            createdAt: true,
            wallet: {
              select: {
                balance: true,
                reservedBalance: true,
              },
            },
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
      },
      orderBy: {
        createdAt: "desc",
        id: "asc",
      },
    });

    const hasMore = withdrawals.length > limit
    if (hasMore) withdrawals.pop()

    return NextResponse.json({
      withdrawals: withdrawals.map((withdrawal) => ({
        ...withdrawal,
        amount: withdrawal.amount.toString(),
        user: withdrawal.user
          ? {
              ...withdrawal.user,
              wallet: withdrawal.user.wallet
                ? {
                    balance: withdrawal.user.wallet.balance.toString(),
                    reservedBalance: withdrawal.user.wallet.reservedBalance.toString(),
                  }
                : null,
            }
          : null,
      })),
      nextCursor: hasMore ? withdrawals[withdrawals.length - 1]?.id ?? null : null,
    });
  } catch (error) {
    console.error("ADMIN_WITHDRAWALS_GET_ERROR", error);

    return NextResponse.json(
      { error: "Unable to load admin withdrawals." },
      { status: 500 }
    );
  }
}
