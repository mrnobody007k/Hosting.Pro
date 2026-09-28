import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'USER' || !session.managerId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const { id } = await context.params
    const user = await prisma.user.findFirst({
      where: { id: session.sub, managerId: session.managerId },
      select: { id: true, managerId: true, status: true, signupStatus: true, manager: { select: { status: true } } },
    })
    if (!user || user.status !== 'ACTIVE' || user.signupStatus !== 'APPROVED' || user.manager.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Your account setup is still in progress.' }, { status: 403 })
    }

    const property = await prisma.property.findFirst({
      where: {
        id,
        status: 'ACTIVE',
        OR: [{ managerId: user.managerId }, { managerId: null }],
      },
      select: { id: true, title: true, location: true, description: true, price: true, imageUrl: true, propertyUrl: true, createdAt: true },
    })
    if (!property) return NextResponse.json({ error: 'This property is no longer available.' }, { status: 404 })

    return NextResponse.json({ property: { ...property, price: property.price.toString() } })
  } catch (error) {
    console.error('USER_PROPERTY_DETAIL_ERROR', error)
    return NextResponse.json({ error: 'Unable to load this property.' }, { status: 500 })
  }
}
