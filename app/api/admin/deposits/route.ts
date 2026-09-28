import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requireAdminAuth } from "@/lib/admin-auth"
import { AdminPermission } from "@/lib/admin-permissions"

export async function GET() {
  try {
    const auth = await requireAdminAuth(AdminPermission.MANAGE_DEPOSITS)
    if (!auth.ok) return auth.response
    const session = auth.session

    const deposits = await prisma.deposit.findMany({
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
      deposits: deposits.map((deposit) => ({
        ...deposit,
        amount: deposit.amount.toString(),
        user: deposit.user
          ? {
              ...deposit.user,
              wallet: deposit.user.wallet
                ? {
                    balance: deposit.user.wallet.balance.toString(),
                    reservedBalance: deposit.user.wallet.reservedBalance.toString(),
                  }
                : null,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("ADMIN_DEPOSITS_GET_ERROR", error);

    return NextResponse.json(
      { error: "Unable to load admin deposits." },
      { status: 500 }
    );
  }
}
