import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import {
  handleRequestSecurityError,
  readJson,
  requireSameOrigin,
} from '@/lib/security'
import { AdminPermission, isSuperAdmin } from '@/lib/admin-permissions'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(req)

    const session = await getSession()

    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    if (!isSuperAdmin(session.adminType ?? "")) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    const { id } = await params
    const adminId = id || ""

    if (!adminId || adminId.length > 100) {
      return NextResponse.json({ error: 'Admin ID is required.' }, { status: 400 })
    }

    const targetAdmin = await prisma.adminUser.findUnique({
      where: { id: adminId },
      select: { id: true, adminType: true, email: true },
    }) as any

    if (!targetAdmin) {
      return NextResponse.json({ error: 'Admin account not found.' }, { status: 404 })
    }

    if (targetAdmin.id === session.sub) {
      return NextResponse.json({ error: 'Cannot modify your own account.' }, { status: 400 })
    }

    if (targetAdmin.adminType === 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Cannot modify Super Admin account.' }, { status: 403 })
    }

    const body = await readJson<{
      status?: unknown
      name?: unknown
      permissions?: unknown
      password?: unknown
    }>(req)

    const data: {
      status?: 'ACTIVE' | 'SUSPENDED' | 'DISABLED'
      name?: string
      permissions?: string[]
      passwordHash?: string
    } = {}

    if (body?.status !== undefined) {
      const status = String(body.status)
      if (!['ACTIVE', 'SUSPENDED', 'DISABLED'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status.' }, { status: 400 })
      }
      data.status = status as 'ACTIVE' | 'SUSPENDED' | 'DISABLED'
    }

    if (body?.name !== undefined) {
      const name = String(body.name).trim()
      if (!name || name.length > 120) {
        return NextResponse.json({ error: 'Invalid name.' }, { status: 400 })
      }
      data.name = name
    }

    if (body?.permissions !== undefined) {
      const permissions = Array.isArray(body.permissions) ? body.permissions : []
      const validPermissions = permissions.filter(p => Object.values(AdminPermission).includes(p as AdminPermission))
      if (validPermissions.length !== permissions.length) {
        return NextResponse.json({ error: 'Invalid permissions.' }, { status: 400 })
      }
      data.permissions = validPermissions
    }

    if (body?.password !== undefined) {
      const password = String(body.password)
      if (password.length > 0) {
        if (password.length < 12 || password.length > 200) {
          return NextResponse.json({ error: 'Password must be between 12 and 200 characters.' }, { status: 400 })
        }
        data.passwordHash = await bcrypt.hash(password, 12)
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid changes provided.' }, { status: 400 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const admin = await tx.adminUser.update({
        where: { id: adminId },
        data,
        select: { id: true, name: true, email: true, status: true, adminType: true, permissions: true, updatedAt: true },
      }) as any

      await tx.auditLog.create({
        data: {
          actorType: 'ADMIN',
          actorId: session.sub,
          action: 'ADMIN_ACCOUNT_UPDATED',
          targetType: 'ADMIN_USER',
          targetId: id,
          metadata: {
            statusChanged: data.status !== undefined,
            nameChanged: data.name !== undefined,
            permissionsChanged: data.permissions !== undefined,
            passwordChanged: data.passwordHash !== undefined,
          },
        },
      })

      return admin
    })

    return NextResponse.json({ ok: true, admin: updated })
  } catch (error) {
    const securityResponse = handleRequestSecurityError(error)
    if (securityResponse) return securityResponse

    console.error('ADMIN_ACCOUNT_UPDATE_ERROR', error)
    return NextResponse.json({ error: 'Unable to update admin account.' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(req)

    const session = await getSession()

    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    if (!isSuperAdmin(session.adminType ?? "")) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    const { id } = await params
    const adminId = id || ""

    if (!adminId || adminId.length > 100) {
      return NextResponse.json({ error: 'Admin ID is required.' }, { status: 400 })
    }

    const targetAdmin = await prisma.adminUser.findUnique({
      where: { id: adminId },
      select: { id: true, adminType: true, email: true },
    })

    if (!targetAdmin) {
      return NextResponse.json({ error: 'Admin account not found.' }, { status: 404 })
    }

    if (targetAdmin.id === session.sub) {
      return NextResponse.json({ error: 'Cannot delete your own account.' }, { status: 400 })
    }

    if (targetAdmin.adminType === 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Cannot delete Super Admin account.' }, { status: 403 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.adminUser.delete({ where: { id: adminId } })

      await tx.auditLog.create({
        data: {
          actorType: 'ADMIN',
          actorId: session.sub,
          action: 'ADMIN_ACCOUNT_DELETED',
          targetType: 'ADMIN_USER',
          targetId: id,
          metadata: { email: targetAdmin.email },
        },
      })
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const securityResponse = handleRequestSecurityError(error)
    if (securityResponse) return securityResponse

    console.error('ADMIN_ACCOUNT_DELETE_ERROR', error)
    return NextResponse.json({ error: 'Unable to delete admin account.' }, { status: 500 })
  }
}