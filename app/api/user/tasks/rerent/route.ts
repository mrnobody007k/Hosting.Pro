import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  handleRequestSecurityError,
  requireSameOrigin,
} from '@/lib/security'

/**
 * Re-Rent activities are created only by the assigned manager. Keep this
 * endpoint as an explicit rejection so stale clients cannot create a second
 * user-originated workflow.
 */
export async function POST(req: Request) {
  try {
    requireSameOrigin(req)

    const session = await getSession()
    if (!session || session.role !== 'USER' || !session.managerId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    return NextResponse.json(
      {
        error: 'Re-Rent activities must be assigned by your manager. Check your Task Center for an assigned activity.',
      },
      { status: 410 },
    )
  } catch (error) {
    const securityResponse = handleRequestSecurityError(error)
    if (securityResponse) return securityResponse

    console.error('USER_RERENT_LEGACY_ROUTE_ERROR', error)
    return NextResponse.json({ error: 'Unable to load Re-Rent activity.' }, { status: 500 })
  }
}
