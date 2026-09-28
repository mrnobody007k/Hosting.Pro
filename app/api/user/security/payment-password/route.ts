import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { handleRequestSecurityError, readJson, requireSameOrigin } from '@/lib/security'

export async function POST(request: Request) {
  try {
    requireSameOrigin(request)
    const session = await getSession()
    if (!session || session.role !== 'USER' || !session.managerId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const body = await readJson<{
      currentPassword?: unknown
      currentPaymentPassword?: unknown
      paymentPassword?: unknown
      confirmPaymentPassword?: unknown
    }>(request, 16 * 1024)
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''
    const currentPaymentPassword = typeof body.currentPaymentPassword === 'string' ? body.currentPaymentPassword : ''
    const paymentPassword = typeof body.paymentPassword === 'string' ? body.paymentPassword : ''
    const confirmPaymentPassword = typeof body.confirmPaymentPassword === 'string' ? body.confirmPaymentPassword : ''

    if (!currentPassword || paymentPassword.length < 6 || paymentPassword.length > 200) {
      return NextResponse.json({ error: 'Enter your current account password and a payment password of 6 to 200 characters.' }, { status: 400 })
    }
    if (paymentPassword !== confirmPaymentPassword) {
      return NextResponse.json({ error: 'Payment passwords do not match.' }, { status: 400 })
    }

    const user = await prisma.user.findFirst({
      where: { id: session.sub, managerId: session.managerId, status: 'ACTIVE', signupStatus: 'APPROVED', manager: { status: 'ACTIVE' } },
      select: { id: true, managerId: true, passwordHash: true, paymentPasswordHash: true },
    })
    if (!user) return NextResponse.json({ error: 'Your account is not currently active.' }, { status: 403 })
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return NextResponse.json({ error: 'Your current account password is incorrect.' }, { status: 403 })
    }
    if (user.paymentPasswordHash) {
      if (!currentPaymentPassword || !(await bcrypt.compare(currentPaymentPassword, user.paymentPasswordHash))) {
        return NextResponse.json({ error: 'Your current payment password is incorrect.' }, { status: 403 })
      }
    }
    if (await bcrypt.compare(paymentPassword, user.passwordHash)) {
      return NextResponse.json({ error: 'Choose a payment password different from your account password.' }, { status: 400 })
    }

    const newHash = await bcrypt.hash(paymentPassword, 12)
    await prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: {
          id: user.id,
          managerId: session.managerId!,
          status: 'ACTIVE',
          signupStatus: 'APPROVED',
          passwordHash: user.passwordHash,
          paymentPasswordHash: user.paymentPasswordHash,
        },
        data: { paymentPasswordHash: newHash },
      })
      if (updated.count !== 1) throw new Error('ACCOUNT_CHANGED')
      await tx.auditLog.create({
        data: {
          actorType: 'USER', actorId: user.id, managerId: user.managerId,
          action: 'USER_PAYMENT_PASSWORD_UPDATED', targetType: 'USER', targetId: user.id,
        },
      })
    }, { isolationLevel: 'Serializable' })

    return NextResponse.json({ ok: true, message: 'Payment password updated.' })
  } catch (error) {
    const securityResponse = handleRequestSecurityError(error)
    if (securityResponse) return securityResponse
    if (error instanceof Error && error.message === 'ACCOUNT_CHANGED') {
      return NextResponse.json({ error: 'Your account changed. Refresh and try again.' }, { status: 409 })
    }
    console.error('USER_PAYMENT_PASSWORD_UPDATE_ERROR', error)
    return NextResponse.json({ error: 'Unable to update your payment password.' }, { status: 500 })
  }
}
