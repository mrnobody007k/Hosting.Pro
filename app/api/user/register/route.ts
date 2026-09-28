import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import {
  handleRequestSecurityError,
  isValidEmail,
  readJson,
  requireSameOrigin,
} from '@/lib/security'

export async function POST(req: Request) {
  try {
    requireSameOrigin(req)

    const body = await readJson<{
      name?: unknown
      email?: unknown
      age?: unknown
      profession?: unknown
      phone?: unknown
      password?: unknown
      confirmPassword?: unknown
      paymentPassword?: unknown
      confirmPaymentPassword?: unknown
      referralCode?: unknown
    }>(req, 32 * 1024)

    const name = String(
      body?.name || '',
    ).trim()

    const email = String(
      body?.email || '',
    )
      .trim()
      .toLowerCase()

    const age = Number(body?.age)

    const profession = String(
      body?.profession || '',
    ).trim()

    const phoneInput = String(
      body?.phone || '',
    ).trim()
    const phone = phoneInput.replace(/[\s().-]/g, '')

    const password = String(
      body?.password || '',
    )

    const confirmPassword = String(
      body?.confirmPassword || '',
    )

    const paymentPassword = String(
      body?.paymentPassword || '',
    )

    const confirmPaymentPassword =
      String(
        body?.confirmPaymentPassword ||
          '',
      )

    const referralCode = String(
      body?.referralCode || '',
    )
      .trim()
      .toUpperCase()

    if (
      !name ||
      name.length > 120
    ) {
      return NextResponse.json(
        {
          error:
            'Full name is required.',
        },
        { status: 400 },
      )
    }

    if (
      !Number.isInteger(age) ||
      age < 18 ||
      age > 100
    ) {
      return NextResponse.json(
        {
          error:
            'Age must be between 18 and 100.',
        },
        { status: 400 },
      )
    }

    if (
      !profession ||
      profession.length > 120
    ) {
      return NextResponse.json(
        {
          error:
            'Profession is required.',
        },
        { status: 400 },
      )
    }

    if (
      !/^\+?\d{7,15}$/.test(phone)
    ) {
      return NextResponse.json(
        {
          error:
            'A valid phone number is required.',
        },
        { status: 400 },
      )
    }

    if (
      !isValidEmail(email)
    ) {
      return NextResponse.json(
        {
          error:
            'A valid email address is required.',
        },
        { status: 400 },
      )
    }

    if (
      password.length < 6 ||
      password.length > 200
    ) {
      return NextResponse.json(
        {
          error:
            'Password must be at least 6 characters.',
        },
        { status: 400 },
      )
    }

    if (
      password !==
      confirmPassword
    ) {
      return NextResponse.json(
        {
          error:
            'Password and confirm password do not match.',
        },
        { status: 400 },
      )
    }

    if (paymentPassword.length < 6 || paymentPassword.length > 200) {
      return NextResponse.json(
        {
          error: 'Payment password must be between 6 and 200 characters.',
        },
        { status: 400 },
      )
    }

    if (paymentPassword !== confirmPaymentPassword) {
      return NextResponse.json(
        {
          error:
            'Payment password and confirmation do not match.',
        },
        { status: 400 },
      )
    }

    if (!referralCode || referralCode.length > 100) {
      return NextResponse.json(
        {
          error: 'A valid invitation code is required.',
        },
        { status: 400 },
      )
    }

    const [passwordHash, paymentPasswordHash] = await Promise.all([
      bcrypt.hash(password, 12),
      bcrypt.hash(paymentPassword, 12),
    ])

    const result =
      await prisma.$transaction(
        async (tx) => {
          /*
           * Referral code is the ONLY source of ownership.
           * managerId is never accepted from the client.
           */
          const manager =
            await tx.manager.findUnique({
              where: {
                referralCode,
              },
              select: {
                id: true,
                name: true,
                status: true,
              },
            })

          if (
            !manager ||
            manager.status !==
              'ACTIVE'
          ) {
            throw new Error(
              'INVALID_MANAGER',
            )
          }

          /*
           * Check all account namespaces before creation.
           * Database unique constraints remain the final protection
           * against concurrent duplicate registration.
           */
          const [
            userExists,
            managerExists,
            adminExists,
          ] = await Promise.all([
            tx.user.findUnique({
              where: { email },
              select: { id: true },
            }),
            tx.manager.findUnique({
              where: { email },
              select: { id: true },
            }),
            tx.adminUser.findUnique({
              where: { email },
              select: { id: true },
            }),
          ])

          if (
            userExists ||
            managerExists ||
            adminExists
          ) {
            throw new Error(
              'DUPLICATE_EMAIL',
            )
          }

          const user =
            await tx.user.create({
              data: {
                name,
                email,
                age,
                profession,
                phone,
                passwordHash,
                paymentPasswordHash,

                /*
                 * LOCKED OWNERSHIP RULE:
                 * referral code -> manager.id
                 */
                managerId:
                  manager.id,

                signupStatus:
                  'PENDING',

                membershipStatus:
                  'PENDING_APPROVAL',

                wallet: {
                  create: {
                    balance: 0,
                  },
                },
              },
              select: {
                id: true,
                name: true,
                email: true,
                managerId: true,
              },
            })

          await tx.auditLog.create({
            data: {
              actorType: 'USER',
              actorId: user.id,
              managerId:
                manager.id,
              action:
                'USER_REGISTERED',
              targetType: 'USER',
              targetId: user.id,
              metadata: {
                referralCode,
                signupStatus:
                  'PENDING',
                membershipStatus:
                  'PENDING_APPROVAL',
              },
            },
          })

          return {
            user,
            managerName:
              manager.name,
          }
        },
        {
          isolationLevel:
            'Serializable',
        },
      )

    return NextResponse.json({
      ok: true,
      message:
        'Your Housing.pro account has been created and is being set up. You can sign in to continue.',
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
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
        'INVALID_MANAGER'
    ) {
      return NextResponse.json(
        {
            error:
              'That access code is not valid. Check the code and try again.',
        },
        { status: 400 },
      )
    }

    if (
      error instanceof Error &&
      error.message ===
        'DUPLICATE_EMAIL'
    ) {
      return NextResponse.json(
        {
          error:
            'An account with this email already exists.',
        },
        { status: 409 },
      )
    }

    console.error(
      'USER_REGISTER_ERROR',
      error,
    )

    return NextResponse.json(
      {
        error:
          'Unable to create account.',
      },
      { status: 500 },
    )
  }
}
