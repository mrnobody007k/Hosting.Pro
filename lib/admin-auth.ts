import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { AdminPermission, isSuperAdmin, hasPermission } from '@/lib/admin-permissions'

export type AdminAuthResult = 
  | { ok: true; session: Awaited<ReturnType<typeof getSession>> & { adminType: string; permissions: string[] } }
  | { ok: false; response: NextResponse }

export async function requireAdminAuth(requiredPermission?: AdminPermission): Promise<AdminAuthResult> {
  const session = await getSession()

  if (!session || session.role !== 'ADMIN') {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
  }

  if (!session.adminType || !session.permissions) {
    return { ok: false, response: NextResponse.json({ error: 'Invalid admin session.' }, { status: 403 }) }
  }

  if (isSuperAdmin(session.adminType)) {
    return { ok: true, session: { ...session, adminType: session.adminType, permissions: session.permissions } }
  }

  // Staff sessions must always name the capability being used. Otherwise a
  // route that forgets to pass a permission silently becomes open to every
  // staff admin.
  if (!requiredPermission || !hasPermission(session.permissions, requiredPermission)) {
    return { ok: false, response: NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 }) }
  }

  return { ok: true, session: { ...session, adminType: session.adminType, permissions: session.permissions } }
}

export function requirePermission(permission: AdminPermission) {
  return async (): Promise<AdminAuthResult> => {
    return requireAdminAuth(permission)
  }
}
