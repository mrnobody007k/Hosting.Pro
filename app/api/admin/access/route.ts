import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { clearSession } from "@/lib/auth";
import { requireAdminAuth } from "@/lib/admin-auth"
import { AdminPermission } from "@/lib/admin-permissions"
import {
  readJson,
  requireSameOrigin,
  handleRequestSecurityError,
} from "@/lib/security";

export async function GET() {
  try {
    const auth = await requireAdminAuth(AdminPermission.MANAGE_SECURITY)
    if (!auth.ok) return auth.response
    const session = auth.session

    const admin = await prisma.adminUser.findUnique({
      where: { id: session.sub },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
      },
    });

    if (!admin) {
      return NextResponse.json(
        { error: "Admin account not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      admin,
      security: {
        sessionDuration: "8 hours",
        cookieHttpOnly: true,
        sameSite: "Lax",
        productionCookie: "__Host-platform_session",
        roleProtected: true,
        databaseStatusChecked: true,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to load admin access information" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);

    const auth = await requireAdminAuth(AdminPermission.MANAGE_SECURITY)
    if (!auth.ok) return auth.response
    const session = auth.session

    const body = await readJson(request);

    const currentPassword =
      typeof body.currentPassword === "string"
        ? body.currentPassword
        : "";

    const newPassword =
      typeof body.newPassword === "string"
        ? body.newPassword
        : "";

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required." },
        { status: 400 },
      );
    }

    if (newPassword.length < 10) {
      return NextResponse.json(
        { error: "New password must be at least 10 characters." },
        { status: 400 },
      );
    }

    if (newPassword.length > 128) {
      return NextResponse.json(
        { error: "New password is too long." },
        { status: 400 },
      );
    }

    if (
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword)
    ) {
      return NextResponse.json(
        {
          error:
            "New password must contain uppercase, lowercase, and a number.",
        },
        { status: 400 },
      );
    }

    const admin = await prisma.adminUser.findUnique({
      where: { id: session.sub },
      select: {
        id: true,
        passwordHash: true,
        status: true,
        name: true,
        email: true,
      },
    });

    if (!admin || admin.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Admin account is not active." },
        { status: 403 },
      );
    }

    const validCurrentPassword =
      await bcrypt.compare(
        currentPassword,
        admin.passwordHash,
      );

    if (!validCurrentPassword) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 400 },
      );
    }

    const samePassword =
      await bcrypt.compare(
        newPassword,
        admin.passwordHash,
      );

    if (samePassword) {
      return NextResponse.json(
        {
          error:
            "New password must be different from the current password.",
        },
        { status: 400 },
      );
    }

    const passwordHash =
      await bcrypt.hash(newPassword, 12);

    await prisma.$transaction(
      async (tx) => {
        await tx.adminUser.update({
          where: { id: admin.id },
          data: { passwordHash },
        });

        await tx.auditLog.create({
          data: {
            actorType: "ADMIN",
            actorId: admin.id,
            action: "ADMIN_PASSWORD_CHANGED",
            targetType: "AdminUser",
            targetId: admin.id,
            metadata: {
              email: admin.email,
              securityAction: true,
            },
          },
        });
      },
      {
        isolationLevel: "Serializable",
      },
    );

    await clearSession();

    return NextResponse.json({
      success: true,
      message:
        "Admin password changed successfully. Sign in again with the new password.",
    });
  } catch (error) {
    const securityResponse =
      handleRequestSecurityError(error);

    if (securityResponse) {
      return securityResponse;
    }

    return NextResponse.json(
      { error: "Unable to change admin password." },
      { status: 500 },
    );
  }
}
