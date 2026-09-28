import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/admin-auth"
import { AdminPermission } from "@/lib/admin-permissions"

export async function GET() {
  try {
    const auth = await requireAdminAuth(AdminPermission.MANAGE_USERS)
    if (!auth.ok) return auth.response
    const session = auth.session

    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: "desc",
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
    });

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
    });
  } catch (error) {
    console.error("ADMIN_CLIENTS_GET_ERROR", error);

    return NextResponse.json(
      { error: "Unable to load clients" },
      { status: 500 }
    );
  }
}
