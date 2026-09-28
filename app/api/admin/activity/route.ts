import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requireAdminAuth } from "@/lib/admin-auth"
import { AdminPermission } from "@/lib/admin-permissions"

export async function GET(request: Request) {
  try {
    const auth = await requireAdminAuth(AdminPermission.VIEW_ACTIVITY)
    if (!auth.ok) return auth.response
    const session = auth.session

    const { searchParams } = new URL(request.url);

    const search = (searchParams.get("search") || "").trim();
    const actorType = (searchParams.get("actorType") || "").trim();
    const managerId = (searchParams.get("managerId") || "").trim();
    const action = (searchParams.get("action") || "").trim();
    const limitParam = Number(searchParams.get("limit") || "200");

    const limit = Math.min(
      Math.max(Number.isFinite(limitParam) ? limitParam : 200, 1),
      500
    );

    const where: any = {};

    if (actorType && ["ADMIN", "MANAGER", "USER"].includes(actorType)) {
      where.actorType = actorType;
    }

    if (managerId) {
      where.managerId = managerId;
    }

    if (action) {
      where.action = {
        contains: action,
        mode: "insensitive",
      };
    }

    if (search) {
      where.OR = [
        {
          action: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          targetType: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          targetId: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          actorId: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
            referralCode: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    return NextResponse.json({
      activities: logs.map((log) => ({
        id: log.id,
        actorType: log.actorType,
        actorId: log.actorId,
        managerId: log.managerId,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        amount: log.amount === null ? null : log.amount.toString(),
        metadata: log.metadata,
        createdAt: log.createdAt,
        manager: log.manager,
      })),
    });
  } catch (error) {
    console.error("ADMIN_ACTIVITY_GET_ERROR", error);

    return NextResponse.json(
      { error: "Unable to load admin activity." },
      { status: 500 }
    );
  }
}
