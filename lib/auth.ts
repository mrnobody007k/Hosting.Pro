import { cookies } from 'next/headers'
import { jwtVerify, SignJWT } from 'jose'
import { createHmac, timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'

export type SessionRole =
  | 'ADMIN'
  | 'MANAGER'
  | 'USER'

export type Session = {
  sub: string
  role: SessionRole
  managerId?: string
  adminType?: string
  permissions?: string[]
}

const PRODUCTION_COOKIE_NAME =
  '__Host-platform_session'

const DEVELOPMENT_COOKIE_NAME =
  'platform_session'

function isDevelopmentRuntime() {
  return process.env.NODE_ENV === 'development'
}

function getCookieName() {
  return isDevelopmentRuntime()
    ? DEVELOPMENT_COOKIE_NAME
    : PRODUCTION_COOKIE_NAME
}

function getSecret() {
  const value =
    process.env.AUTH_SECRET?.trim()

  if (!value || value.length < 32) {
    if (!isDevelopmentRuntime()) {
      throw new Error(
        'AUTH_SECRET must be set to a random value of at least 32 characters outside development.',
      )
    }

    return 'development-only-change-this-secret-1234567890'
  }

  return value
}

export async function createSession(
  session: Session,
  passwordHash: string,
) {
  const secret = new TextEncoder().encode(
    getSecret(),
  )

  const token = await new SignJWT({ ...session, credentialVersion: getCredentialVersion(session, passwordHash) })
    .setProtectedHeader({
      alg: 'HS256',
      typ: 'JWT',
    })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret)

  const jar = await cookies()

  jar.set(getCookieName(), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: !isDevelopmentRuntime(),
    path: '/',
    maxAge: 60 * 60 * 8,
  })
}

function getCredentialVersion(session: Pick<Session, 'role' | 'sub'>, passwordHash: string) {
  return createHmac('sha256', getSecret())
    .update(`${session.role}:${session.sub}:${passwordHash}`, 'utf8')
    .digest('hex')
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies()

  /*
   * SECURITY:
   *
   * Production accepts ONLY the __Host- cookie.
   * Development accepts ONLY the development cookie.
   *
   * No cross-environment legacy-cookie fallback.
   */
  const token =
    jar.get(getCookieName())?.value

  if (!token) {
    return null
  }

  try {
    const secret = new TextEncoder().encode(
      getSecret(),
    )

    const { payload } =
      await jwtVerify(
        token,
        secret,
        {
          algorithms: ['HS256'],
        },
      )

    if (
      !payload.sub ||
      !payload.role
    ) {
      return null
    }

    if (
      ![
        'ADMIN',
        'MANAGER',
        'USER',
      ].includes(
        String(payload.role),
      )
    ) {
      return null
    }

    const role =
      payload.role as SessionRole

    /*
     * ADMIN
     */
    if (role === 'ADMIN') {
      const account =
        await prisma.adminUser.findUnique({
          where: {
            id: String(payload.sub),
          },
          select: {
            status: true,
            adminType: true,
            permissions: true,
            passwordHash: true,
          },
        }) as any

      if (
        !account ||
        account.status !== 'ACTIVE' ||
        !validCredentialVersion(payload.credentialVersion, getCredentialVersion({ role, sub: String(payload.sub) }, account.passwordHash))
      ) {
        return null
      }

      return {
        sub: String(payload.sub),
        role,
        adminType: account.adminType,
        permissions: account.permissions,
      }
    }

    /*
     * MANAGER
     */
    if (role === 'MANAGER') {
      const manager =
        await prisma.manager.findUnique({
          where: {
            id: String(payload.sub),
          },
          select: {
            id: true,
            status: true,
            passwordHash: true,
          },
        })

      if (
        !manager ||
        manager.status !== 'ACTIVE' ||
        !validCredentialVersion(payload.credentialVersion, getCredentialVersion({ role, sub: String(payload.sub) }, manager.passwordHash))
      ) {
        return null
      }

      return {
        sub: String(payload.sub),
        role,
        managerId: manager.id,
      }
    }

    /*
     * USER
     */
    const user =
      await prisma.user.findUnique({
        where: {
          id: String(payload.sub),
        },
        select: {
          id: true,
          managerId: true,
          status: true,
          passwordHash: true,
          manager: { select: { status: true } },
        },
      })

    if (
      !user ||
      user.status !== 'ACTIVE' ||
      user.manager.status !== 'ACTIVE' ||
      !validCredentialVersion(payload.credentialVersion, getCredentialVersion({ role, sub: String(payload.sub) }, user.passwordHash))
    ) {
      return null
    }

    return {
      sub: String(payload.sub),
      role,
      managerId: user.managerId,
    }
  } catch {
    return null
  }
}

function validCredentialVersion(actual: unknown, expected: string) {
  if (typeof actual !== 'string' || !/^[a-f0-9]{64}$/.test(actual)) return false
  return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'))
}

export async function clearSession() {
  const jar = await cookies()

  jar.delete(getCookieName())
}
