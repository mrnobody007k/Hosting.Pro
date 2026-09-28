import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import {
  handleRequestSecurityError,
  readJson,
  requireSameOrigin,
} from '@/lib/security'
import { AdminPermission, isSuperAdmin, hasPermission } from '@/lib/admin-permissions'

export async function GET() {
  try {
    const session = await getSession()

    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    if (!isSuperAdmin(session.adminType ?? "")) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    const admins = await prisma.adminUser.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        adminType: true,
        permissions: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ admins })
  } catch (error) {
    console.error('ADMIN_ACCOUNTS_GET_ERROR', error)
    return NextResponse.json({ error: 'Unable to load admin accounts.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    requireSameOrigin(req)

    const session = await getSession()

    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    if (!isSuperAdmin(session.adminType ?? "")) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    const body = await readJson<{
      name?: unknown
      email?: unknown
      password?: unknown
      adminType?: unknown
      permissions?: unknown
    }>(req)

    const name = String(body?.name || '').trim()
    const email = String(body?.email || '').trim().toLowerCase()
    const password = String(body?.password || '')
    const adminType = String(body?.adminType || 'STAFF_ADMIN').toUpperCase()
    const permissions = Array.isArray(body?.permissions) ? body.permissions : []

    if (!name || name.length > 120 || !email || !isValidEmail(email) || password.length < 12 || password.length > 200) {
      return NextResponse.json({ error: 'Name, valid email, and password (12+) are required.' }, { status: 400 })
    }

    if (!['SUPER_ADMIN', 'STAFF_ADMIN'].includes(adminType)) {
      return NextResponse.json({ error: 'Invalid admin type.' }, { status: 400 })
    }

    if (adminType === 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Cannot create additional Super Admin accounts.' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.adminUser.findUnique({ where: { email }, select: { id: true } })
      if (existing) throw new Error('DUPLICATE')

      const admin = await tx.adminUser.create({
        data: { name, email, passwordHash, adminType: adminType as any, permissions },
        select: { id: true, name: true, email: true, adminType: true, permissions: true, createdAt: true },
      })

      await tx.auditLog.create({
        data: {
          actorType: 'ADMIN',
          actorId: session.sub,
          action: 'ADMIN_ACCOUNT_CREATED',
          targetType: 'ADMIN_USER',
          targetId: admin.id,
          metadata: { adminType, permissions },
        },
      })

      return admin
    })

    return NextResponse.json({ ok: true, admin: { ...result, passwordHash: undefined } })
  } catch (error) {
    const securityResponse = handleRequestSecurityError(error)
    if (securityResponse) return securityResponse

    if (error instanceof Error && error.message === 'DUPLICATE') {
      return NextResponse.json({ error: 'Email already exists.' }, { status: 409 })
    }

    console.error('ADMIN_ACCOUNT_CREATE_ERROR', error)
    return NextResponse.json({ error: 'Unable to create admin account.' }, { status: 500 })
  }
}

function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}