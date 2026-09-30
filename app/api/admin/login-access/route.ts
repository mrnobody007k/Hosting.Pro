import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/admin-auth'
import { AdminPermission } from '@/lib/admin-permissions'
import {
  handleRequestSecurityError,
  readJson,
  requireSameOrigin,
  getPublicAppOrigin,
} from '@/lib/security'
import { generateAccessToken, storeAccessToken } from '@/lib/access-token'

export async function GET() {
  try {
    getPublicAppOrigin()
    const auth = await requireAdminAuth(AdminPermission.MANAGE_LOGIN_ACCESS)
    if (!auth.ok) return auth.response
    const session = auth.session

    const [setting, customerRotation, managerRotation] = await Promise.all([
      prisma.platformSetting.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { customerLoginAccessToken: true, managerLoginAccessToken: true },
      }),
      prisma.auditLog.findFirst({
        where: { action: 'LOGIN_ACCESS_TOKEN_ROTATED', metadata: { path: ['target'], equals: 'customer' } },
        orderBy: { createdAt: 'desc' }, select: { createdAt: true },
      }),
      prisma.auditLog.findFirst({
        where: { action: 'LOGIN_ACCESS_TOKEN_ROTATED', metadata: { path: ['target'], equals: 'manager' } },
        orderBy: { createdAt: 'desc' }, select: { createdAt: true },
      }),
    ])

    return NextResponse.json({
      customer: setting?.customerLoginAccessToken
        ? {
            active: true,
            lastRotatedAt: customerRotation?.createdAt ?? null,
          }
        : { active: false, lastRotatedAt: customerRotation?.createdAt ?? null },
      manager: setting?.managerLoginAccessToken
        ? {
            active: true,
            lastRotatedAt: managerRotation?.createdAt ?? null,
          }
        : { active: false, lastRotatedAt: managerRotation?.createdAt ?? null },
    })
  } catch (error) {
    console.error('ADMIN_LOGIN_ACCESS_GET_ERROR', error)
    return NextResponse.json(
      { error: 'Unable to load login access settings.' },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  try {
    requireSameOrigin(req)

    const auth = await requireAdminAuth(AdminPermission.MANAGE_LOGIN_ACCESS)
    if (!auth.ok) return auth.response
    const session = auth.session

    const body = await readJson<{ target?: unknown }>(req)
    const target = String(body?.target || '').toLowerCase()

    if (!['customer', 'manager'].includes(target)) {
      return NextResponse.json(
        { error: 'Invalid target. Must be "customer" or "manager".' },
        { status: 400 },
      )
    }

    const newToken = generateAccessToken()

    const setting = await prisma.$transaction(async (tx) => {
      const existing = await tx.platformSetting.findFirst({ orderBy: { updatedAt: 'desc' } })

      const updated = existing
        ? await tx.platformSetting.update({
          where: { id: existing.id },
          data: target === 'customer'
            ? { customerLoginAccessToken: storeAccessToken(newToken) }
            : { managerLoginAccessToken: storeAccessToken(newToken) },
          select: {
            id: true,
            updatedAt: true,
          },
        })
        : await tx.platformSetting.create({
          data: target === 'customer'
            ? { customerLoginAccessToken: storeAccessToken(newToken) }
            : { managerLoginAccessToken: storeAccessToken(newToken) },
          select: {
            id: true,
            updatedAt: true,
          },
        })
      await tx.auditLog.create({ data: {
        actorType: 'ADMIN',
        actorId: session.sub,
        action: 'LOGIN_ACCESS_TOKEN_ROTATED',
        targetType: 'LOGIN_ACCESS',
        targetId: target,
        metadata: { target },
      } })
      return updated
    })

    const baseUrl = getPublicAppOrigin() || new URL(req.url).origin
    const loginUrl = target === 'customer'
      ? `${baseUrl}/login/${newToken}`
      : `${baseUrl}/manager-login/${newToken}`

    return NextResponse.json({
      ok: true,
      target,
      loginUrl,
      updatedAt: setting.updatedAt,
      warning: `New ${target} login URL generated. The previous URL is now invalid.`,
    })
  } catch (error) {
    const securityResponse = handleRequestSecurityError(error)
    if (securityResponse) return securityResponse

    console.error('ADMIN_LOGIN_ACCESS_POST_ERROR', error)
    return NextResponse.json(
      { error: 'Unable to rotate login access token.' },
      { status: 500 },
    )
  }
}

export async function DELETE(req: Request) {
  try {
    requireSameOrigin(req)
    const auth = await requireAdminAuth(AdminPermission.MANAGE_LOGIN_ACCESS)
    if (!auth.ok) return auth.response

    const body = await readJson<{ target?: unknown }>(req)
    const target = String(body?.target || '').toLowerCase()
    if (target !== 'customer' && target !== 'manager') {
      return NextResponse.json({ error: 'Invalid access link.' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const setting = await tx.platformSetting.findFirst({ orderBy: { updatedAt: 'desc' }, select: { id: true } })
      if (!setting) return false

      const changed = await tx.platformSetting.updateMany({
        where: {
          id: setting.id,
          ...(target === 'customer'
            ? { customerLoginAccessToken: { not: null } }
            : { managerLoginAccessToken: { not: null } }),
        },
        data: target === 'customer'
          ? { customerLoginAccessToken: null }
          : { managerLoginAccessToken: null },
      })

      if (changed.count > 0) {
        await tx.auditLog.create({ data: {
          actorType: 'ADMIN',
          actorId: auth.session.sub,
          action: 'LOGIN_ACCESS_TOKEN_REVOKED',
          targetType: 'LOGIN_ACCESS',
          targetId: target,
          metadata: { target },
        } })
      }
      return changed.count > 0
    })

    return NextResponse.json({ ok: true, revoked: result, target })
  } catch (error) {
    const securityResponse = handleRequestSecurityError(error)
    if (securityResponse) return securityResponse
    console.error('ADMIN_LOGIN_ACCESS_REVOKE_ERROR', error)
    return NextResponse.json({ error: 'Unable to revoke login access.' }, { status: 500 })
  }
}
