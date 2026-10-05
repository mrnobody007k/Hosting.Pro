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
import { getPublicAppOrigin } from '@/lib/security'

export async function GET(req: Request) {
  try {
    const auth = await requireAdminAuth(AdminPermission.MANAGE_PLATFORM_SETTINGS)
    if (!auth.ok) return auth.response
    const session = auth.session

    const [setting, activeManagers] = await Promise.all([prisma.platformSetting.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        managerSeatLimit: true,
        welcomeBalance: true,
        day2ProfitRate: true,
        day3ProfitRate: true,
        rerentDelaySeconds: true,
        depositInstructions: true,
        createdAt: true,
        updatedAt: true,
      },
    }), prisma.manager.count({ where: { status: 'ACTIVE' } })])

    if (!setting) {
      return NextResponse.json({
        setting: {
          id: null,
          managerSeatLimit: 10,
          welcomeBalance: '120.00',
          day2ProfitRate: '1.20',
          day3ProfitRate: '1.40',
          rerentDelaySeconds: 90,
          depositInstructions: 'Use the payment details shared with your Housing.pro account, then submit your payment reference or proof.',
          createdAt: null,
          updatedAt: null,
        },
        activeManagers,
        publicAppOrigin: getPublicAppOrigin() ?? null,
      })
    }

    return NextResponse.json({
      setting: {
        ...setting,
        welcomeBalance: '120.00',
        day2ProfitRate: setting.day2ProfitRate.toString(),
        day3ProfitRate: setting.day3ProfitRate.toString(),
      },
      activeManagers,
      publicAppOrigin: getPublicAppOrigin() ?? null,
    })
  } catch (error) {
    console.error('ADMIN_SETTINGS_READ_ERROR', error)
    return NextResponse.json(
      { error: 'Unable to load platform settings.' },
      { status: 500 },
    )
  }
}

export async function PATCH(req: Request) {
  try {
    requireSameOrigin(req)

    const auth = await requireAdminAuth(AdminPermission.MANAGE_PLATFORM_SETTINGS)
    if (!auth.ok) return auth.response
    const session = auth.session

    const body = await readJson<{
      managerSeatLimit?: unknown
      depositInstructions?: unknown
    }>(req)

    const seats = Number(
      body?.managerSeatLimit,
    )

    if (
      !Number.isInteger(seats) ||
      seats < 1 ||
      seats > 100000
    ) {
      return NextResponse.json(
        {
          error:
            'Manager seat limit must be a valid whole number.',
        },
        { status: 400 },
      )
    }

    let instructions: string | undefined

    if (
      body?.depositInstructions !==
      undefined
    ) {
      instructions =
        String(
          body.depositInstructions,
        )
          .trim()
          .slice(0, 4000)
    }

    const setting =
      await prisma.$transaction(
        async (tx) => {
          const activeManagers =
            await tx.manager.count({
              where: {
                status: 'ACTIVE',
              },
            })

          if (
            seats < activeManagers
          ) {
            throw new Error(
              'BELOW_ACTIVE',
            )
          }

          const existing =
            await tx.platformSetting.findFirst()

          let updatedSetting

          if (existing) {
            updatedSetting =
              await tx.platformSetting.update({
                where: {
                  id: existing.id,
                },
                data: {
                  managerSeatLimit:
                    seats,
                  ...(instructions !==
                  undefined
                    ? {
                        depositInstructions:
                          instructions ||
                          existing.depositInstructions,
                      }
                      : {}),
                },
                select: {
                  id: true,
                  managerSeatLimit: true,
                  welcomeBalance: true,
                  day2ProfitRate: true,
                  day3ProfitRate: true,
                  rerentDelaySeconds: true,
                  depositInstructions: true,
                  createdAt: true,
                  updatedAt: true,
                },
              })
          } else {
            updatedSetting =
              await tx.platformSetting.create({
                data: {
                  managerSeatLimit:
                    seats,
                  ...(instructions
                    ? {
                        depositInstructions:
                          instructions,
                      }
                      : {}),
                },
                select: {
                  id: true,
                  managerSeatLimit: true,
                  welcomeBalance: true,
                  day2ProfitRate: true,
                  day3ProfitRate: true,
                  rerentDelaySeconds: true,
                  depositInstructions: true,
                  createdAt: true,
                  updatedAt: true,
                },
              })
          }

          await tx.auditLog.create({
            data: {
              actorType: 'ADMIN',
              actorId: session.sub,
              action:
                'PLATFORM_SETTINGS_UPDATED',
              targetType:
                'PLATFORM_SETTING',
              targetId:
                updatedSetting.id,
              metadata: {
                managerSeatLimit:
                  seats,
                depositInstructionsChanged:
                  instructions !==
                  undefined,
              },
            },
          })

          return updatedSetting
        },
        {
          isolationLevel:
            'Serializable',
        },
      )

    return NextResponse.json({
      ok: true,
      setting: {
        ...setting,
        welcomeBalance: '120.00',
        day2ProfitRate: setting.day2ProfitRate.toString(),
        day3ProfitRate: setting.day3ProfitRate.toString(),
      },
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
        'BELOW_ACTIVE'
    ) {
      return NextResponse.json(
        {
          error:
            'Seat limit cannot be below current active managers.',
        },
        { status: 400 },
      )
    }

    console.error(
      'ADMIN_SETTINGS_UPDATE_ERROR',
      error,
    )

    return NextResponse.json(
      {
        error:
          'Unable to update platform settings.',
      },
      { status: 500 },
    )
  }
}
