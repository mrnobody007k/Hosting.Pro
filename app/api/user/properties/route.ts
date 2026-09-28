import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()

    if (
      !session ||
      session.role !== 'USER' ||
      !session.managerId
    ) {
      return NextResponse.json(
        { error: 'Unauthorized.' },
        { status: 401 },
      )
    }

    const user = await prisma.user.findUnique({
      where: {
        id: session.sub,
      },
      select: {
        id: true,
        managerId: true,
        status: true,
        signupStatus: true,
        manager: { select: { status: true } },
      },
    })

    if (!user || user.status !== 'ACTIVE' || user.signupStatus !== 'APPROVED' || user.managerId !== session.managerId || user.manager.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Your account setup is still in progress.' },
        { status: 403 },
      )
    }

    /*
     * Property visibility is manager-scoped.
     *
     * A client can only see:
     * 1. Properties owned by their assigned manager.
     * 2. Global properties where managerId is null.
     *
     * Properties belonging to another manager are never returned.
     */
    const properties = await prisma.property.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          {
            managerId: user.managerId,
          },
          {
            managerId: null,
          },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        title: true,
        location: true,
        description: true,
        price: true,
        imageUrl: true,
        propertyUrl: true,
        status: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      properties: properties.map((property) => ({
        ...property,
        price: property.price.toString(),
      })),
    })
  } catch (error) {
    console.error('USER_PROPERTIES_ERROR', error)

    return NextResponse.json(
      { error: 'Unable to load properties.' },
      { status: 500 },
    )
  }
}
