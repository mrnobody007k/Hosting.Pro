import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requireAdminAuth } from "@/lib/admin-auth"
import { AdminPermission } from "@/lib/admin-permissions"

export async function GET() {
  try {
    const auth = await requireAdminAuth(AdminPermission.MANAGE_WITHDRAWALS)
    if (!auth.ok) return auth.response
    const session = auth.session

    const withdrawals = await prisma.withdrawal.findMany({
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
      },
    });

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
    });
  } catch (error) {
    console.error("ADMIN_WITHDRAWALS_GET_ERROR", error);

    return NextResponse.json(
      { error: "Unable to load admin withdrawals." },
      { status: 500 }
    );
  }
}
