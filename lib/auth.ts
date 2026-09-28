import { cookies } from 'next/headers'
import { jwtVerify, SignJWT } from 'jose'
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

function getCookieName() {
  return process.env.NODE_ENV === 'production'
    ? PRODUCTION_COOKIE_NAME
    : DEVELOPMENT_COOKIE_NAME
}

function getSecret() {
  const value =
    process.env.AUTH_SECRET?.trim()

  if (!value || value.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'AUTH_SECRET must be set to a random value of at least 32 characters in production.',
      )
    }

    return 'development-only-change-this-secret-1234567890'
  }

  return value
}

export async function createSession(
  session: Session,
) {
  const secret = new TextEncoder().encode(
    getSecret(),
  )

  const token = await new SignJWT(session)
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
    secure:
      process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8,
  })
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
          },
        }) as any

      if (
        !account ||
        account.status !== 'ACTIVE'
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
          },
        })

      if (
        !manager ||
        manager.status !== 'ACTIVE'
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
        },
      })

    if (
      !user ||
      user.status !== 'ACTIVE'
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

export async function clearSession() {
  const jar = await cookies()

  jar.delete(getCookieName())
}
