import { NextResponse } from 'next/server'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { requireAdminAuth } from '@/lib/admin-auth'
import { AdminPermission } from '@/lib/admin-permissions'
import { handleRequestSecurityError, readJson, requireSameOrigin } from '@/lib/security'

function normalizeStatus(value: unknown) {
  const status = String(value || 'ACTIVE').trim().toUpperCase()
  return ['ACTIVE', 'INACTIVE', 'SOLD_OUT'].includes(status) ? status as 'ACTIVE' | 'INACTIVE' | 'SOLD_OUT' : null
}

function parsePropertyPrice(value: unknown) {
  try {
    if (typeof value !== 'string' && typeof value !== 'number') return null
    const price = new Decimal(String(value).trim())
    return price.isFinite() && price.gt(0) && price.lte('1000000000000000') && price.decimalPlaces() <= 2 ? price : null
  } catch { return null }
}

export async function GET() {
  try {
    const auth = await requireAdminAuth(AdminPermission.MANAGE_PROPERTIES)
    if (!auth.ok) return auth.response
    const session = auth.session

    const properties = await prisma.property.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, location: true, description: true, price: true,
        imageUrl: true, propertyUrl: true, status: true, managerId: true,
        createdAt: true, updatedAt: true,
        manager: { select: { id: true, name: true, referralCode: true } },
        _count: { select: { orders: true } },
      },
    })

    return NextResponse.json({
      properties: properties.map((property) => ({ ...property, price: property.price.toString() })),
    })
  } catch (error) {
    console.error('ADMIN_PROPERTIES_GET_ERROR', error)
    return NextResponse.json({ error: 'Unable to load properties' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    requireSameOrigin(req)
    const auth = await requireAdminAuth(AdminPermission.MANAGE_PROPERTIES)
    if (!auth.ok) return auth.response
    const session = auth.session

    const body = await readJson<{
      title?: unknown; location?: unknown; description?: unknown; price?: unknown
      imageUrl?: unknown; propertyUrl?: unknown; status?: unknown; managerId?: unknown
    }>(req)

    const title = String(body.title || '').trim()
    const location = String(body.location || '').trim().slice(0, 200)
    const description = String(body.description || '').trim().slice(0, 4000)
    const imageUrl = String(body.imageUrl || '').trim().slice(0, 2000)
    const propertyUrl = String(body.propertyUrl || '').trim().slice(0, 2000)
    const price = parsePropertyPrice(body.price)
    const status = normalizeStatus(body.status)
    const managerId = String(body.managerId || '').trim() || null

    if (!title || title.length > 200 || !price || !status) {
      return NextResponse.json({ error: 'Title, valid price and valid status are required.' }, { status: 400 })
    }

    if (managerId) {
      const manager = await prisma.manager.findUnique({ where: { id: managerId }, select: { id: true } })
      if (!manager) return NextResponse.json({ error: 'Selected manager was not found.' }, { status: 400 })
    }

    const property = await prisma.$transaction(async (tx) => {
      const created = await tx.property.create({
        data: {
          title, location: location || null, description: description || null,
          price, imageUrl: imageUrl || null, propertyUrl: propertyUrl || null,
          status, managerId,
        },
      })
      await tx.auditLog.create({
        data: {
          actorType: 'ADMIN', actorId: session.sub, action: 'PROPERTY_CREATED',
          targetType: 'PROPERTY', targetId: created.id,
          amount: created.price,
          metadata: { title: created.title, managerId: created.managerId, status: created.status },
        },
      })
      return created
    })

    return NextResponse.json({ ok: true, property: { ...property, price: property.price.toString() } }, { status: 201 })
  } catch (error) {
    const securityResponse = handleRequestSecurityError(error)
    if (securityResponse) return securityResponse
    console.error('ADMIN_PROPERTIES_CREATE_ERROR', error)
    return NextResponse.json({ error: 'Unable to create property.' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    requireSameOrigin(req)
    const auth = await requireAdminAuth(AdminPermission.MANAGE_PROPERTIES)
    if (!auth.ok) return auth.response
    const session = auth.session

    const body = await readJson<{ id?: unknown; title?: unknown; location?: unknown; description?: unknown; price?: unknown; imageUrl?: unknown; propertyUrl?: unknown; status?: unknown; managerId?: unknown }>(req)
    const id = String(body.id || '').trim()
    if (!id) return NextResponse.json({ error: 'Property ID is required.' }, { status: 400 })

    const existing = await prisma.property.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: 'Property not found.' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (body.title !== undefined) {
      const title = String(body.title || '').trim()
      if (!title || title.length > 200) return NextResponse.json({ error: 'Valid title is required.' }, { status: 400 })
      data.title = title
    }
    if (body.location !== undefined) data.location = String(body.location || '').trim().slice(0, 200) || null
    if (body.description !== undefined) data.description = String(body.description || '').trim().slice(0, 4000) || null
    if (body.imageUrl !== undefined) data.imageUrl = String(body.imageUrl || '').trim().slice(0, 2000) || null
    if (body.propertyUrl !== undefined) data.propertyUrl = String(body.propertyUrl || '').trim().slice(0, 2000) || null
    if (body.price !== undefined) {
      const price = parsePropertyPrice(body.price)
      if (!price) return NextResponse.json({ error: 'Valid positive price is required.' }, { status: 400 })
      data.price = price
    }
    if (body.status !== undefined) {
      const status = normalizeStatus(body.status)
      if (!status) return NextResponse.json({ error: 'Invalid property status.' }, { status: 400 })
      data.status = status
    }
    if (body.managerId !== undefined) {
      const managerId = String(body.managerId || '').trim() || null
      if (managerId) {
        const manager = await prisma.manager.findUnique({ where: { id: managerId }, select: { id: true } })
        if (!manager) return NextResponse.json({ error: 'Selected manager was not found.' }, { status: 400 })
      }
      data.managerId = managerId
    }

    if (!Object.keys(data).length) return NextResponse.json({ error: 'No changes supplied.' }, { status: 400 })

    const property = await prisma.$transaction(async (tx) => {
      const updated = await tx.property.update({ where: { id }, data })
      await tx.auditLog.create({
        data: {
          actorType: 'ADMIN', actorId: session.sub, action: 'PROPERTY_UPDATED',
          targetType: 'PROPERTY', targetId: id,
          metadata: { changedFields: Object.keys(data) },
        },
      })
      return updated
    })

    return NextResponse.json({ ok: true, property: { ...property, price: property.price.toString() } })
  } catch (error) {
    const securityResponse = handleRequestSecurityError(error)
    if (securityResponse) return securityResponse
    console.error('ADMIN_PROPERTIES_UPDATE_ERROR', error)
    return NextResponse.json({ error: 'Unable to update property.' }, { status: 500 })
  }
}
