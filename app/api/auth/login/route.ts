import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createSession } from '@/lib/auth'
import { matchesAccessToken, storeAccessToken } from '@/lib/access-token'
import {
  getClientIp,
  handleRequestSecurityError,
  isValidEmail,
  readJson,
  requireSameOrigin,
} from '@/lib/security'

const WINDOW_MS = 15 * 60 * 1000
const MAX_IDENTIFIER_IP_FAILURES = 10
const MAX_IP_FAILURES = 30

export async function POST(req: Request) {
  try {
    requireSameOrigin(req)

    const body =
      await readJson<{
        identifier?: unknown
        email?: unknown
        password?: unknown
        expectedRole?: unknown
        accessToken?: unknown
      }>(
        req,
        16 * 1024,
      )

    const identifier = String(body?.identifier ?? body?.email ?? '').trim()
    const email = identifier.toLowerCase()
    const normalizedPhone = identifier.replace(/[\s().-]/g, '')
    const isEmail = isValidEmail(email)
    const isPhone = /^\+?\d{7,15}$/.test(normalizedPhone)

    const password = String(
      body?.password || '',
    )
    const expectedRole = body?.expectedRole
    let loginAccessSetting: { id: string; customerLoginAccessToken: string | null; managerLoginAccessToken: string | null } | null = null
    if (!expectedRole || !['USER', 'MANAGER', 'ADMIN'].includes(String(expectedRole))) {
      return NextResponse.json({ error: 'Invalid sign-in details.' }, { status: 401 })
    }

    if (expectedRole === 'USER' || expectedRole === 'MANAGER') {
      loginAccessSetting = await prisma.platformSetting.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { id: true, customerLoginAccessToken: true, managerLoginAccessToken: true },
      })
      const requiredToken = expectedRole === 'USER'
        ? loginAccessSetting?.customerLoginAccessToken
        : loginAccessSetting?.managerLoginAccessToken
      if (!matchesAccessToken(body.accessToken, requiredToken)) {
        return NextResponse.json({ error: 'Invalid sign-in details.' }, { status: 401 })
      }
    }

    if (
      (!isEmail && !isPhone) ||
      password.length > 200
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid sign-in details.',
        },
        { status: 401 },
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters.' },
        { status: 400 },
      )
    }

    const ip = getClientIp(req)

    /*
     * Unknown IPs must not create one global
     * rate-limit bucket for every user.
     *
     * The identifier bucket still protects the account.
     */
    const identifierKey = isEmail ? email : normalizedPhone
    const emailKey =
      `login:${identifierKey}|ip:${ip}`

    const ipKey =
      ip !== 'unknown'
        ? `ip:${ip}`
        : null

    const cutoff = new Date(
      Date.now() - WINDOW_MS,
    )

    await prisma.loginAttempt.deleteMany(
      {
        where: {
          createdAt: {
            lt: cutoff,
          },
        },
      },
    )

    const identifierFailures =
      await prisma.loginAttempt.count({
        where: {
          key: emailKey,
          createdAt: {
            gte: cutoff,
          },
        },
      })

    const ipFailures = ipKey
      ? await prisma.loginAttempt.count(
          {
            where: {
              key: ipKey,
              createdAt: {
                gte: cutoff,
              },
            },
          },
        )
      : 0

    if (
      identifierFailures >=
        MAX_IDENTIFIER_IP_FAILURES ||
      ipFailures >=
        MAX_IP_FAILURES
    ) {
      return NextResponse.json(
        {
          error:
            'Too many failed login attempts. Please try again later.',
        },
        {
          status: 429,
          headers: {
            'Retry-After':
              '900',
          },
        },
      )
    }

    type LoginAccount = {
      id: string
      status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED'
      passwordHash: string
      role: 'ADMIN' | 'MANAGER' | 'USER'
      managerId?: string
    }

    let account: LoginAccount | null = null
    if (isEmail) {
      const [admin, manager, user] = await Promise.all([
        prisma.adminUser.findUnique({ where: { email } }),
        prisma.manager.findUnique({ where: { email } }),
        prisma.user.findUnique({ where: { email } }),
      ])
      const matches = [admin, manager, user].filter(Boolean)
      if (matches.length > 1) {
        console.error('LOGIN_ACCOUNT_COLLISION', { email })
        return NextResponse.json({ error: 'Invalid sign-in details.' }, { status: 401 })
      }
      if (admin) account = { id: admin.id, status: admin.status, passwordHash: admin.passwordHash, role: 'ADMIN' }
      else if (manager) account = { id: manager.id, status: manager.status, passwordHash: manager.passwordHash, role: 'MANAGER', managerId: manager.id }
      else if (user) account = { id: user.id, status: user.status, passwordHash: user.passwordHash, role: 'USER', managerId: user.managerId }
    } else {
      // Phone numbers are not unique in the current schema. Never guess between matches.
      const matches = await prisma.user.findMany({
        where: { phone: { in: [...new Set([identifier, normalizedPhone, normalizedPhone.startsWith('+') ? normalizedPhone.slice(1) : `+${normalizedPhone}`])] } },
        take: 2,
        select: { id: true, status: true, passwordHash: true, managerId: true },
      })
      if (matches.length === 1) {
        const user = matches[0]
        account = { id: user.id, status: user.status, passwordHash: user.passwordHash, role: 'USER', managerId: user.managerId }
      }
    }

    if (
      !account ||
      account.status !== 'ACTIVE' ||
      (expectedRole !== undefined && account.role !== expectedRole) ||
      !(await bcrypt.compare(password, account.passwordHash))
    ) {
      const attemptData =
        ipKey
          ? [
              { key: emailKey },
              { key: ipKey },
            ]
          : [{ key: emailKey }]

      await prisma.loginAttempt.createMany(
        {
          data: attemptData,
        },
      )

      return NextResponse.json(
        {
          error:
            'Invalid sign-in details.',
        },
        { status: 401 },
      )
    }

    /*
     * Successful authentication clears this
     * sign-in identifier's failure history.
     */
    await prisma.loginAttempt.deleteMany(
      {
        where: {
          key: emailKey,
        },
      },
    )

    await createSession({
      sub: account.id,
      role: account.role,
      ...(account.managerId ? { managerId: account.managerId } : {}),
    }, account.passwordHash)

    if ((expectedRole === 'USER' || expectedRole === 'MANAGER') && loginAccessSetting) {
      const legacyToken = expectedRole === 'USER'
        ? loginAccessSetting.customerLoginAccessToken
        : loginAccessSetting.managerLoginAccessToken
      if (legacyToken && !legacyToken.startsWith('sha256:')) {
        await prisma.platformSetting.updateMany({
          where: { id: loginAccessSetting.id, ...(expectedRole === 'USER' ? { customerLoginAccessToken: legacyToken } : { managerLoginAccessToken: legacyToken }) },
          data: expectedRole === 'USER'
            ? { customerLoginAccessToken: storeAccessToken(legacyToken) }
            : { managerLoginAccessToken: storeAccessToken(legacyToken) },
        })
      }
    }

    return NextResponse.json({
      ok: true,
      role: account.role,
    })
  } catch (error) {
    const securityResponse =
      handleRequestSecurityError(
        error,
      )

    if (securityResponse) {
      return securityResponse
    }

    console.error(
      'AUTH_LOGIN_ERROR',
      error,
    )

    return NextResponse.json(
      {
        error:
          'Unable to process login.',
      },
      { status: 500 },
    )
  }
}
