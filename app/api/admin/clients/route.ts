import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/admin-auth"
import { AdminPermission } from "@/lib/admin-permissions"

export async function GET(request: Request) {
  try {
    const auth = await requireAdminAuth(AdminPermission.MANAGE_USERS)
    if (!auth.ok) return auth.response
    const session = auth.session

    const params = new URL(request.url).searchParams
    const requestedLimit = Number(params.get('limit') || '100')
    const limit = Math.min(Math.max(Number.isInteger(requestedLimit) ? requestedLimit : 100, 1), 200)
    const cursor = params.get('cursor') || undefined
    const search = (params.get('search') || '').trim()
    const status = params.get('status') || 'ALL'
    const membershipStatus = params.get('membership') || 'ALL'
    const managerId = params.get('managerId') || 'ALL'
    if ((cursor && cursor.length > 100) || search.length > 200 || (status !== 'ALL' && !['ACTIVE', 'SUSPENDED', 'DISABLED'].includes(status)) || (membershipStatus !== 'ALL' && !['PENDING_APPROVAL', 'DAY_1', 'DAY_2', 'OFFICIAL_MEMBER'].includes(membershipStatus)) || (managerId !== 'ALL' && managerId.length > 100)) {
      return NextResponse.json({ error: 'Invalid client filter or pagination cursor.' }, { status: 400 })
    }
    const where: Record<string, unknown> = {}
    if (status !== 'ALL') where.status = status
    if (membershipStatus !== 'ALL') where.membershipStatus = membershipStatus
    if (managerId !== 'ALL') where.managerId = managerId
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { manager: { name: { contains: search, mode: 'insensitive' } } },
      { manager: { referralCode: { contains: search, mode: 'insensitive' } } },
    ]

    const users = await prisma.user.findMany({
      where,
      orderBy: {
        createdAt: "desc",
        id: "asc",
      },
      select: {
        id: true,
        name: true,
        email: true,
        age: true,
        profession: true,
        phone: true,
        status: true,
        signupStatus: true,
        membershipStatus: true,
        approvedAt: true,
        officialMemberAt: true,
        createdAt: true,
        manager: {
          select: {
            id: true,
            name: true,
            referralCode: true,
          },
        },
        wallet: {
          select: {
            balance: true,
            reservedBalance: true,
          },
        },
        _count: {
          select: {
            orders: true,
            tasks: true,
            deposits: true,
            withdrawals: true,
          },
        },
      },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : undefined,
    });

    const hasMore = users.length > limit
    if (hasMore) users.pop()

    return NextResponse.json({
      clients: users.map((user) => ({
        ...user,
        wallet: user.wallet
          ? {
              balance: user.wallet.balance.toString(),
              reservedBalance: user.wallet.reservedBalance.toString(),
            }
          : null,
      })),
      nextCursor: hasMore ? users[users.length - 1]?.id ?? null : null,
    });
  } catch (error) {
    console.error("ADMIN_CLIENTS_GET_ERROR", error);

    return NextResponse.json(
      { error: "Unable to load clients" },
      { status: 500 }
    );
  }
}
