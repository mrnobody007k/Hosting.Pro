import { NextResponse } from 'next/server'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(request: Request) {
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
    const params = new URL(request.url).searchParams
    const search = (params.get('q') || '').trim().slice(0, 100)
    const location = (params.get('location') || '').trim().slice(0, 100)
    const sort = params.get('sort')
    const cursor = params.get('cursor')
    const rawMin = params.get('minPrice')
    const rawMax = params.get('maxPrice')
    if ((cursor && cursor.length > 100) || (rawMin && rawMin.length > 24) || (rawMax && rawMax.length > 24)) {
      return NextResponse.json({ error: 'Invalid property filter.' }, { status: 400 })
    }
    const priceFilter: { gte?: Decimal; lte?: Decimal } = {}
    try {
      if (rawMin) priceFilter.gte = new Decimal(rawMin)
      if (rawMax) priceFilter.lte = new Decimal(rawMax)
      if (Object.values(priceFilter).some((value) => !value.isFinite() || value.isNegative())) throw new Error('INVALID_PRICE')
      if (priceFilter.gte && priceFilter.lte && priceFilter.gte.gt(priceFilter.lte)) throw new Error('INVALID_PRICE')
    } catch {
      return NextResponse.json({ error: 'Enter a valid price range.' }, { status: 400 })
    }
    const orderBy = sort === 'price-low'
      ? [{ price: 'asc' as const }, { id: 'asc' as const }]
      : sort === 'price-high'
        ? [{ price: 'desc' as const }, { id: 'asc' as const }]
        : [{ createdAt: 'desc' as const }, { id: 'desc' as const }]

    if (cursor) {
      const cursorProperty = await prisma.property.findFirst({
        where: { id: cursor, status: 'ACTIVE', OR: [{ managerId: user.managerId }, { managerId: null }] },
        select: { id: true },
      })
      if (!cursorProperty) return NextResponse.json({ error: 'Invalid property page cursor.' }, { status: 400 })
    }

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
        ...(search ? { AND: [{ OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { location: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ] }] } : {}),
        ...(location ? { location: { contains: location, mode: 'insensitive' as const } } : {}),
        ...(Object.keys(priceFilter).length ? { price: priceFilter } : {}),
      },
      orderBy,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: 25,
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

    const nextCursor = properties.length === 25 ? properties[properties.length - 1].id : null
    return NextResponse.json({
      properties: properties.map((property) => ({
        ...property,
        price: property.price.toString(),
      })),
      nextCursor,
    })
  } catch (error) {
    console.error('USER_PROPERTIES_ERROR', error)

    return NextResponse.json(
      { error: 'Unable to load properties.' },
      { status: 500 },
    )
  }
}
