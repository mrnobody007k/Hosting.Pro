import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createSession } from '@/lib/auth'
import { matchesAccessToken, storeAccessToken } from '@/lib/access-token'
import { findLoginAccountByEmail, verifyLoginAccount, type LoginAccount, type LoginRole } from '@/lib/login-account'
import { checkLoginAttemptLimit, finalizeLoginAttempt, getLoginAttemptBuckets } from '@/lib/login-rate-limit'
import {
  getClientIp,
  handleRequestSecurityError,
  isValidEmail,
  readJson,
  requireSameOrigin,
} from '@/lib/security'

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
    const loginBuckets = getLoginAttemptBuckets(identifierKey, ip)
    const attemptCheck = await checkLoginAttemptLimit(prisma, loginBuckets)

    if (!attemptCheck.allowed) {
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

    if (expectedRole === 'USER' || expectedRole === 'MANAGER') {
      loginAccessSetting = await prisma.platformSetting.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { id: true, customerLoginAccessToken: true, managerLoginAccessToken: true },
      })
      const requiredToken = expectedRole === 'USER'
        ? loginAccessSetting?.customerLoginAccessToken
        : loginAccessSetting?.managerLoginAccessToken
      if (!matchesAccessToken(body.accessToken, requiredToken)) {
        const failedAccessCheck = await finalizeLoginAttempt(prisma, loginBuckets, attemptCheck, async () => false)
        if (failedAccessCheck.rateLimited) {
          return NextResponse.json(
            { error: 'Too many failed login attempts. Please try again later.' },
            { status: 429, headers: { 'Retry-After': '900' } },
          )
        }
        return NextResponse.json({ error: 'Invalid sign-in details.' }, { status: 401 })
      }
    }

    let account: LoginAccount | null = null
    if (isEmail) {
      const lookup = await findLoginAccountByEmail(prisma, email, expectedRole as LoginRole)
      if (lookup.collision) {
        console.error('LOGIN_ACCOUNT_COLLISION', { email })
        return NextResponse.json({ error: 'Invalid sign-in details.' }, { status: 401 })
      }
      account = lookup.account
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

    const loginOutcome = await finalizeLoginAttempt(prisma, loginBuckets, attemptCheck, () =>
      verifyLoginAccount(account, expectedRole as LoginRole, password, bcrypt.compare)
    )

    if (!loginOutcome.authenticated) {
      if (loginOutcome.rateLimited) {
        return NextResponse.json(
          { error: 'Too many failed login attempts. Please try again later.' },
          { status: 429, headers: { 'Retry-After': '900' } },
        )
      }
      return NextResponse.json(
        {
          error:
            'Invalid sign-in details.',
        },
        { status: 401 },
      )
    }

    // The verifier can only succeed with a non-null account; retain an explicit
    // guard here so TypeScript and the route boundary both enforce that fact.
    if (!account) {
      return NextResponse.json({ error: 'Invalid sign-in details.' }, { status: 401 })
    }

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
