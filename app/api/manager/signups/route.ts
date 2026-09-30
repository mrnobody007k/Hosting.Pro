import { NextResponse } from 'next/server'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { handleRequestSecurityError, readJson, requireSameOrigin } from '@/lib/security'

const DAY_1_WELCOME_BALANCE = new Decimal('120.00')

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

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId, managerId: session.managerId! },
        select: { id: true, name: true, managerId: true, signupStatus: true },
      })
      if (!user) throw new Error('USER_NOT_FOUND')
      if (user.signupStatus !== 'PENDING') throw new Error('SIGNUP_ALREADY_PROCESSED')

      const processedAt = new Date()
      const claimed = await tx.user.updateMany({
        where: { id: user.id, managerId: session.managerId!, signupStatus: 'PENDING' },
        data: action === 'APPROVE'
          ? { signupStatus: 'APPROVED', membershipStatus: 'DAY_1', status: 'ACTIVE', approvedAt: processedAt }
          : { signupStatus: 'REJECTED', status: 'DISABLED' },
      })
      if (claimed.count !== 1) throw new Error('SIGNUP_ALREADY_PROCESSED')

      let balanceAfter: Decimal | null = null
      if (action === 'APPROVE') {
        const wallet = await tx.wallet.findUnique({ where: { userId: user.id }, select: { balance: true } })
        if (!wallet) throw new Error('USER_WALLET_NOT_FOUND')
        const reference = `day1-welcome:${user.id}`
        const existingWelcome = await tx.transaction.findFirst({
          where: { userId: user.id, type: 'WELCOME_BONUS', reference },
          select: { id: true },
        })
        if (existingWelcome) throw new Error('WELCOME_CREDIT_ALREADY_EXISTS')
        const balanceBefore = new Decimal(wallet.balance.toString())
        balanceAfter = balanceBefore.add(DAY_1_WELCOME_BALANCE)
        await tx.wallet.update({ where: { userId: user.id }, data: { balance: { increment: DAY_1_WELCOME_BALANCE } } })
        await tx.transaction.create({
          data: {
            userId: user.id, managerId: session.managerId!, type: 'WELCOME_BONUS',
            amount: DAY_1_WELCOME_BALANCE, balanceBefore, balanceAfter, reference,
            note: 'Day 1 signup approval welcome balance.',
          },
        })
      }

      await tx.auditLog.create({
        data: {
          actorType: 'MANAGER', actorId: session.sub, managerId: session.managerId!,
          action: action === 'APPROVE' ? 'USER_SIGNUP_APPROVED' : 'USER_SIGNUP_REJECTED',
          targetType: 'USER', targetId: user.id,
          ...(action === 'APPROVE' ? { amount: DAY_1_WELCOME_BALANCE } : {}),
          metadata: { userName: user.name, ...(action === 'APPROVE' ? { membershipStatus: 'DAY_1' } : {}) },
        },
      })
      await tx.notification.create({
        data: action === 'APPROVE'
          ? { userId: user.id, type: 'SUCCESS', title: 'Your account is ready', message: `Your account setup is complete. INR ${DAY_1_WELCOME_BALANCE.toFixed(2)} has been added to your wallet. You are now on Day 1.` }
          : { userId: user.id, type: 'WARNING', title: 'Account update', message: 'Your account could not be activated. Please contact Housing.pro support.' },
      })
      return { action, balanceAfter }
    }, { isolationLevel: 'Serializable' })

    return NextResponse.json({
      ok: true,
      message: result.action === 'APPROVE' ? `Signup approved. INR ${DAY_1_WELCOME_BALANCE.toFixed(2)} welcome balance added.` : 'Signup rejected.',
      ...(result.action === 'APPROVE' ? { welcomeBalance: DAY_1_WELCOME_BALANCE.toFixed(2) } : {}),
    })
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
    const securityResponse = handleRequestSecurityError(error)
    if (securityResponse) return securityResponse
    console.error('MANAGER_SIGNUP_APPROVAL_ERROR', error)
    return NextResponse.json({ error: 'Unable to process signup approval.' }, { status: 500 })
  }
}
