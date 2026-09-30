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
    const cursor = searchParams.get("cursor") || undefined;
    const limitParam = Number(searchParams.get("limit") || "200");

    const limit = Math.min(Math.max(Number.isInteger(limitParam) ? limitParam : 100, 1), 200);
    if (search.length > 200 || action.length > 120 || managerId.length > 100 || (cursor && cursor.length > 100) || (actorType && !["ADMIN", "MANAGER", "USER"].includes(actorType))) {
      return NextResponse.json({ error: "Invalid activity filter." }, { status: 400 });
    }

    const where: any = {};

    if (actorType) {
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
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : undefined,
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
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });

    const hasMore = logs.length > limit;
    if (hasMore) logs.pop();
    const redactMetadata = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(redactMetadata);
      if (!value || typeof value !== "object") return value;
      return Object.fromEntries(Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !/(password|hash|secret|token|credential|database|db.?url|connection.?string|auth|proof|account.?details|api.?key|private.?key|session)/i.test(key))
        .map(([key, item]) => [key, redactMetadata(item)]));
    };

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
        metadata: redactMetadata(log.metadata),
        createdAt: log.createdAt,
        manager: log.manager,
      })),
      nextCursor: hasMore ? logs[logs.length - 1]?.id ?? null : null,
    });
  } catch (error) {
    console.error("ADMIN_ACTIVITY_GET_ERROR", error);

    return NextResponse.json(
      { error: "Unable to load admin activity." },
      { status: 500 }
    );
  }
}
