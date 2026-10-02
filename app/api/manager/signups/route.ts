import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { handleRequestSecurityError, readJson, requireSameOrigin } from '@/lib/security'
import { approveSignupTransaction, SIGNUP_WELCOME_BALANCE } from '@/lib/signup-approval'

export async function POST(req: Request) {
  try {
    requireSameOrigin(req)
    const session = await getSession()
    if (!session || session.role !== 'MANAGER' || !session.managerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await readJson<{ userId?: unknown; action?: unknown }>(req, 16 * 1024)
    const userId = String(body?.userId || '').trim()
    const action = String(body?.action || '').trim().toUpperCase()
    if (!userId || !['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json({ error: 'User ID and valid approval action are required.' }, { status: 400 })
    }

    if (action === 'APPROVE') {
      const result = await approveSignupTransaction(prisma, userId, { type: 'MANAGER', id: session.sub, managerId: session.managerId })
      return NextResponse.json({ ok: true, message: `Signup approved. INR ${SIGNUP_WELCOME_BALANCE} welcome balance added.`, welcomeBalance: SIGNUP_WELCOME_BALANCE, balanceAfter: result.balanceAfter.toFixed(2) })
    }

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({ where: { id: userId, managerId: session.managerId }, select: { id: true, name: true, signupStatus: true } })
      if (!user) throw new Error('USER_NOT_FOUND')
      if (user.signupStatus !== 'PENDING') throw new Error('SIGNUP_ALREADY_PROCESSED')
      const claimed = await tx.user.updateMany({ where: { id: userId, managerId: session.managerId!, signupStatus: 'PENDING' }, data: { signupStatus: 'REJECTED', status: 'DISABLED' } })
      if (claimed.count !== 1) throw new Error('SIGNUP_ALREADY_PROCESSED')
      await tx.auditLog.create({ data: { actorType: 'MANAGER', actorId: session.sub, managerId: session.managerId!, action: 'USER_SIGNUP_REJECTED', targetType: 'USER', targetId: user.id, metadata: { userName: user.name } } })
      await tx.notification.create({ data: { userId: user.id, type: 'WARNING', title: 'Account update', message: 'Your account could not be activated. Please contact Housing.pro support.' } })
    }, { isolationLevel: 'Serializable' })

    return NextResponse.json({ ok: true, message: 'Signup rejected.' })
  } catch (error) {
    if (error instanceof Error && error.message === 'SIGNUP_ALREADY_PROCESSED') {
      return NextResponse.json({ error: 'This signup has already been processed.' }, { status: 409 })
    }
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      return NextResponse.json({ error: 'Client not found under your manager account.' }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'USER_WALLET_NOT_FOUND') {
      return NextResponse.json({ error: 'Client wallet was not found.' }, { status: 500 })
    }
    if (error instanceof Error && error.message === 'WELCOME_CREDIT_ALREADY_EXISTS') {
      return NextResponse.json({ error: 'A Day 1 welcome credit already exists for this account.' }, { status: 409 })
    }
    if (error instanceof Error && error.message === 'SIGNUP_APPROVAL_CONFLICT') {
      return NextResponse.json({ error: 'Approval is busy. Check the client status, then retry if it is still pending.' }, { status: 409 })
    }
    const securityResponse = handleRequestSecurityError(error)
    if (securityResponse) return securityResponse
    console.error('MANAGER_SIGNUP_APPROVAL_ERROR')
    return NextResponse.json({ error: 'Unable to process signup approval.' }, { status: 500 })
  }
}
