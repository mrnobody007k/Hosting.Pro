import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { requireAdminAuth } from '@/lib/admin-auth'
import { AdminPermission } from '@/lib/admin-permissions'
import {
  handleRequestSecurityError,
  isValidEmail,
  readJson,
  requireSameOrigin,
} from '@/lib/security'

export async function GET(request: Request) {
  try {
    const auth = await requireAdminAuth(AdminPermission.MANAGE_MANAGERS)
    if (!auth.ok) return auth.response
    const params = new URL(request.url).searchParams
    const search = (params.get('search') || '').trim()
    const status = params.get('status') || 'ALL'
    const requestedLimit = Number(params.get('limit') || '50')
    const limit = Math.min(Math.max(Number.isInteger(requestedLimit) ? requestedLimit : 50, 1), 100)
    const cursor = params.get('cursor') || undefined
    if (search.length > 200 || (cursor && cursor.length > 100) || (status !== 'ALL' && !['ACTIVE', 'SUSPENDED', 'DISABLED'].includes(status))) {
      return NextResponse.json({ error: 'Invalid manager filter.' }, { status: 400 })
    }
    const where: Record<string, unknown> = {}
    if (status !== 'ALL') where.status = status
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { referralCode: { contains: search, mode: 'insensitive' } },
    ]
    const [managers, activeManagers, totalClients, setting] = await Promise.all([
      prisma.manager.findMany({
        where,
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        skip: cursor ? 1 : undefined,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: {
          id: true, name: true, email: true, referralCode: true, status: true, createdAt: true,
          paymentAccountLabel: true, paymentAccountDetails: true,
          _count: { select: { users: true } },
        },
      }),
      prisma.manager.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count(),
      prisma.platformSetting.findFirst({ select: { managerSeatLimit: true } }),
    ])
    const hasMore = managers.length > limit
    if (hasMore) managers.pop()
    return NextResponse.json({
      managers,
      activeManagers,
      totalClients,
      managerSeatLimit: setting?.managerSeatLimit ?? 10,
      nextCursor: hasMore ? managers[managers.length - 1]?.id ?? null : null,
    })
  } catch (error) {
    console.error('ADMIN_MANAGERS_GET_ERROR', error)
    return NextResponse.json({ error: 'Unable to load managers.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    requireSameOrigin(req)

    const auth = await requireAdminAuth(AdminPermission.MANAGE_MANAGERS)
    if (!auth.ok) return auth.response
    const session = auth.session

    const body = await readJson<{
      name?: unknown
      email?: unknown
      password?: unknown
      referralCode?: unknown
    }>(req)

    const name = String(
      body?.name || '',
    ).trim()

    const email = String(
      body?.email || '',
    )
      .trim()
      .toLowerCase()

    const password = String(
      body?.password || '',
    )

    const referralCode = String(
      body?.referralCode || '',
    )
      .trim()
      .toUpperCase()

    if (
      !name ||
      name.length > 120 ||
      !isValidEmail(email) ||
      password.length < 12 ||
      password.length > 200 ||
      !referralCode ||
      referralCode.length > 100
    ) {
      return NextResponse.json(
        {
          error:
            'Name, valid email, password (12+), and referral code are required.',
        },
        { status: 400 },
      )
    }

    const passwordHash =
      await bcrypt.hash(
        password,
        12,
      )

    const result =
      await prisma.$transaction(
        async (tx) => {
          const setting =
            await tx.platformSetting.findFirst()

          const activeManagers =
            await tx.manager.count({
              where: {
                status: 'ACTIVE',
              },
            })

          if (
            setting &&
            activeManagers >=
              setting.managerSeatLimit
          ) {
            throw new Error(
              'SEAT_LIMIT',
            )
          }

          const [
            managerExists,
            adminExists,
            userExists,
          ] = await Promise.all([
            tx.manager.findFirst({
              where: {
                OR: [
                  { email },
                  { referralCode },
                ],
              },
              select: {
                id: true,
              },
            }),
            tx.adminUser.findUnique({
              where: { email },
              select: {
                id: true,
              },
            }),
            tx.user.findUnique({
              where: { email },
              select: {
                id: true,
              },
            }),
          ])

          if (
            managerExists ||
            adminExists ||
            userExists
          ) {
            throw new Error(
              'DUPLICATE',
            )
          }

          const manager =
            await tx.manager.create({
              data: {
                name,
                email,
                passwordHash,
                referralCode,
              },
            })

          await tx.auditLog.create({
            data: {
              actorType: 'ADMIN',
              actorId: session.sub,
              managerId: manager.id,
              action:
                'MANAGER_CREATED',
              targetType: 'MANAGER',
              targetId: manager.id,
              metadata: {
                referralCode,
                email,
              },
            },
          })

          return manager
        },
        {
          isolationLevel:
            'Serializable',
        },
      )

    return NextResponse.json({
      ok: true,
      id: result.id,
    })
  } catch (error) {
    const securityResponse =
      handleRequestSecurityError(
        error,
      )

    if (securityResponse) {
      return securityResponse
    }

    if (
      error instanceof Error &&
      error.message ===
        'SEAT_LIMIT'
    ) {
      return NextResponse.json(
        {
          error:
            'Manager seat limit reached. Increase seats first.',
        },
        { status: 409 },
      )
    }

    if (
      error instanceof Error &&
      error.message ===
        'DUPLICATE'
    ) {
      return NextResponse.json(
        {
          error:
            'Email or referral code already exists.',
        },
        { status: 409 },
      )
    }

    console.error(
      'ADMIN_MANAGER_CREATE_ERROR',
      error,
    )

    return NextResponse.json(
      {
        error:
          'Unable to create manager.',
      },
      { status: 500 },
    )
  }
}

export async function PATCH(req: Request) {
  try {
    requireSameOrigin(req)

    const auth = await requireAdminAuth(AdminPermission.MANAGE_MANAGERS)
    if (!auth.ok) return auth.response
    const session = auth.session

    const body = await readJson<{
      id?: unknown
      status?: unknown
      name?: unknown
      paymentAccountLabel?: unknown
      paymentAccountDetails?: unknown
      password?: unknown
    }>(req)

    const id = String(
      body?.id || '',
    ).trim()

    if (
      !id ||
      id.length > 100
    ) {
      return NextResponse.json(
        {
          error:
            'Manager id is required.',
        },
        { status: 400 },
      )
    }

    const data: {
      status?: 'ACTIVE' | 'SUSPENDED' | 'DISABLED'
      name?: string
      paymentAccountLabel?: string | null
      paymentAccountDetails?: string | null
      passwordHash?: string
    } = {}

    if (
      body?.status !== undefined
    ) {
      const status =
        String(body.status)

      if (
        ![
          'ACTIVE',
          'SUSPENDED',
          'DISABLED',
        ].includes(status)
      ) {
        return NextResponse.json(
          {
            error:
              'Invalid status.',
          },
          { status: 400 },
        )
      }

      data.status =
        status as
          | 'ACTIVE'
          | 'SUSPENDED'
          | 'DISABLED'
    }

    if (
      body?.name !== undefined
    ) {
      const name = String(
        body.name,
      ).trim()

      if (
        !name ||
        name.length > 120
      ) {
        return NextResponse.json(
          {
            error:
              'Manager name is invalid.',
          },
          { status: 400 },
        )
      }

      data.name = name
    }

    if (
      body?.paymentAccountLabel !==
      undefined
    ) {
      data.paymentAccountLabel =
        String(
          body.paymentAccountLabel,
        )
          .trim()
          .slice(0, 200) || null
    }

    if (
      body?.paymentAccountDetails !==
      undefined
    ) {
      data.paymentAccountDetails =
        String(
          body.paymentAccountDetails,
        )
          .trim()
          .slice(0, 4000) || null
    }

    if (
      body?.password !== undefined
    ) {
      const password = String(
        body.password,
      )

      if (
        password.length > 0
      ) {
        if (
          password.length < 12 ||
          password.length > 200
        ) {
          return NextResponse.json(
            {
              error:
                'Password must be between 12 and 200 characters.',
            },
            { status: 400 },
          )
        }

        data.passwordHash =
          await bcrypt.hash(
            password,
            12,
          )
      }
    }

    if (
      Object.keys(data).length === 0
    ) {
      return NextResponse.json(
        {
          error:
            'No valid manager changes were provided.',
        },
        { status: 400 },
      )
    }

    const updated =
      await prisma.$transaction(
        async (tx) => {
          /*
           * Re-read the manager INSIDE the transaction
           * so status/seat decisions use current DB state.
           */
          const manager =
            await tx.manager.findUnique({
              where: { id },
              select: {
                id: true,
                status: true,
              },
            })

          if (!manager) {
            throw new Error(
              'MANAGER_NOT_FOUND',
            )
          }

          if (
            data.status ===
              'ACTIVE' &&
            manager.status !==
              'ACTIVE'
          ) {
            const setting =
              await tx.platformSetting.findFirst()

            const activeManagers =
              await tx.manager.count({
                where: {
                  status: 'ACTIVE',
                },
              })

            if (
              setting &&
              activeManagers >=
                setting.managerSeatLimit
            ) {
              throw new Error(
                'SEAT_LIMIT',
              )
            }
          }

          const managerUpdated =
            await tx.manager.update({
              where: {
                id,
              },
              data,
              select: {
                id: true,
                status: true,
              },
            })

          await tx.auditLog.create({
            data: {
              actorType: 'ADMIN',
              actorId: session.sub,
              managerId: id,
              action:
                'MANAGER_UPDATED',
              targetType: 'MANAGER',
              targetId: id,
              metadata: {
                status:
                  data.status ??
                  null,
                name:
                  data.name ??
                  null,
                passwordChanged:
                  Boolean(
                    data.passwordHash,
                  ),
                paymentDetailsChanged:
                  data.paymentAccountDetails !==
                    undefined ||
                  data.paymentAccountLabel !==
                    undefined,
              },
            },
          })

          return managerUpdated
        },
        {
          isolationLevel:
            'Serializable',
        },
      )

    return NextResponse.json({
      ok: true,
      manager: updated,
    })
  } catch (error) {
    const securityResponse =
      handleRequestSecurityError(
        error,
      )

    if (securityResponse) {
      return securityResponse
    }

    if (
      error instanceof Error &&
      error.message ===
        'MANAGER_NOT_FOUND'
    ) {
      return NextResponse.json(
        {
          error:
            'Manager not found.',
        },
        { status: 404 },
      )
    }

    if (
      error instanceof Error &&
      error.message ===
        'SEAT_LIMIT'
    ) {
      return NextResponse.json(
        {
          error:
            'Manager seat limit reached. Increase seats first.',
        },
        { status: 409 },
      )
    }

    console.error(
      'ADMIN_MANAGER_UPDATE_ERROR',
      error,
    )

    return NextResponse.json(
      {
        error:
          'Unable to update manager.',
      },
      { status: 500 },
    )
  }
}
