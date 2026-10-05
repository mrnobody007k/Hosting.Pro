import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/admin-auth'
import { approveSignupTransaction, SIGNUP_WELCOME_BALANCE } from '@/lib/signup-approval'
import { handleRequestSecurityError, requireSameOrigin } from '@/lib/security'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request)
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response
    if (auth.session.adminType !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only a Super Admin can override signup approval.' }, { status: 403 })
    }

    const { id } = await context.params
    if (!id || id.length > 100) return NextResponse.json({ error: 'Invalid client.' }, { status: 400 })

    await approveSignupTransaction(prisma, id, { type: 'ADMIN', id: auth.session.sub })
    return NextResponse.json({ ok: true, message: `Signup approved. INR ${SIGNUP_WELCOME_BALANCE} welcome credit recorded.`, welcomeBalance: SIGNUP_WELCOME_BALANCE })
  } catch (error) {
    const securityResponse = handleRequestSecurityError(error)
    if (securityResponse) return securityResponse
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'SIGNUP_ALREADY_PROCESSED') {
      return NextResponse.json({ error: 'This signup has already been processed.' }, { status: 409 })
    }
    if (error instanceof Error && error.message === 'USER_WALLET_NOT_FOUND') {
      return NextResponse.json({ error: 'Client wallet was not found.' }, { status: 500 })
    }
    if (error instanceof Error && error.message === 'WELCOME_CREDIT_ALREADY_EXISTS') {
      return NextResponse.json({ error: 'A welcome credit already exists for this account.' }, { status: 409 })
    }
    if (error instanceof Error && error.message === 'SIGNUP_APPROVAL_CONFLICT') {
      return NextResponse.json({ error: 'Approval is busy. Check the client status, then retry if it is still pending.' }, { status: 409 })
    }
    console.error('ADMIN_SIGNUP_APPROVAL_ERROR')
    return NextResponse.json({ error: 'Unable to process signup approval.' }, { status: 500 })
  }
}
