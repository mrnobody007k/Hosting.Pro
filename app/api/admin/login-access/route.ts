import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { requireAdminAuth } from '@/lib/admin-auth'
import { AdminPermission } from '@/lib/admin-permissions'
import {
  handleRequestSecurityError,
  readJson,
  requireSameOrigin,
} from '@/lib/security'
import { generateAccessToken } from '@/lib/access-token'

export async function GET(req: Request) {
  try {
    const auth = await requireAdminAuth(AdminPermission.MANAGE_LOGIN_ACCESS)
    if (!auth.ok) return auth.response
    const session = auth.session

    const setting = await prisma.platformSetting.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: {
        customerLoginAccessToken: true,
        managerLoginAccessToken: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    const baseUrl = process.env.PUBLIC_APP_URL || new URL(req.url).origin

    return NextResponse.json({
      customer: setting?.customerLoginAccessToken
        ? {
            active: true,
            token: setting.customerLoginAccessToken,
            loginUrl: `${baseUrl}/login/${setting.customerLoginAccessToken}`,
            updatedAt: setting.updatedAt,
          }
        : { active: false, token: null, loginUrl: null, updatedAt: null },
      manager: setting?.managerLoginAccessToken
        ? {
            active: true,
            token: setting.managerLoginAccessToken,
            loginUrl: `${baseUrl}/manager-login/${setting.managerLoginAccessToken}`,
            updatedAt: setting.updatedAt,
          }
        : { active: false, token: null, loginUrl: null, updatedAt: null },
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
      const existing = await tx.platformSetting.findFirst()

      if (existing) {
        return tx.platformSetting.update({
          where: { id: existing.id },
          data: target === 'customer'
            ? { customerLoginAccessToken: newToken }
            : { managerLoginAccessToken: newToken },
          select: {
            id: true,
            customerLoginAccessToken: true,
            managerLoginAccessToken: true,
            updatedAt: true,
          },
        })
      } else {
        return tx.platformSetting.create({
          data: target === 'customer'
            ? { customerLoginAccessToken: newToken }
            : { managerLoginAccessToken: newToken },
          select: {
            id: true,
            customerLoginAccessToken: true,
            managerLoginAccessToken: true,
            updatedAt: true,
          },
        })
      }
    })

    await prisma.auditLog.create({
      data: {
        actorType: 'ADMIN',
        actorId: session.sub,
        action: 'LOGIN_ACCESS_TOKEN_ROTATED',
        targetType: 'PLATFORM_SETTING',
        targetId: setting.id,
        metadata: { target },
      },
    })

    const baseUrl = process.env.PUBLIC_APP_URL || new URL(req.url).origin
    const loginUrl = target === 'customer'
      ? `${baseUrl}/login/${newToken}`
      : `${baseUrl}/manager-login/${newToken}`

    return NextResponse.json({
      ok: true,
      target,
      token: newToken,
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