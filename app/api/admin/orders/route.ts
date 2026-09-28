import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requireAdminAuth } from "@/lib/admin-auth"
import { AdminPermission } from "@/lib/admin-permissions"

export async function GET() {
  try {
    const auth = await requireAdminAuth(AdminPermission.MANAGE_ORDERS)
    if (!auth.ok) return auth.response
    const session = auth.session

    const orders = await prisma.order.findMany({
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
      },
    });

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
    });
  } catch (error) {
    console.error("ADMIN_ORDERS_GET_ERROR", error);

    return NextResponse.json(
      { error: "Unable to load admin orders." },
      { status: 500 }
    );
  }
}
