import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getSession()
    if (!session || session.role !== 'USER' || !session.managerId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const user = await prisma.user.findFirst({
      where: { id: session.sub, managerId: session.managerId },
      select: { displayTier: true },
    })
    if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 })

    return NextResponse.json({ displayTier: user.displayTier })
  } catch (error) {
    console.error('USER_TIER_GET_ERROR', error)
    return NextResponse.json({ error: 'Unable to load your tier.' }, { status: 500 })
  }
}
