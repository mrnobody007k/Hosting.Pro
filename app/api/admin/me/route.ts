import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getSession()

    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const admin = await prisma.adminUser.findUnique({
      where: { id: session.sub },
      select: {
        id: true,
        name: true,
        email: true,
        adminType: true,
        permissions: true,
        status: true,
        createdAt: true,
      },
    }) as any

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found.' }, { status: 404 })
    }

    return NextResponse.json({
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        adminType: admin.adminType,
        permissions: admin.permissions,
        status: admin.status,
        createdAt: admin.createdAt,
      },
    })
  } catch (error) {
    console.error('ADMIN_ME_ERROR', error)
    return NextResponse.json({ error: 'Unable to load admin info.' }, { status: 500 })
  }
}