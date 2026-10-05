import type { PrismaClient } from '@prisma/client'

export type LoginRole = 'ADMIN' | 'MANAGER' | 'USER'

export type LoginAccount = {
  id: string
  status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED'
  passwordHash: string
  role: LoginRole
  managerId?: string
}

type LoginLookupDatabase = Pick<PrismaClient, 'adminUser' | 'manager' | 'user'>

export async function findLoginAccountByEmail(
  database: LoginLookupDatabase,
  email: string,
  expectedRole: LoginRole,
): Promise<{ account: LoginAccount | null; collision: boolean }> {
  const [admin, manager, user] = await Promise.all([
    database.adminUser.findUnique({
      where: { email },
      select: expectedRole === 'ADMIN'
        ? { id: true, status: true, passwordHash: true }
        : { id: true },
    }),
    database.manager.findUnique({
      where: { email },
      select: expectedRole === 'MANAGER'
        ? { id: true, status: true, passwordHash: true }
        : { id: true },
    }),
    database.user.findUnique({
      where: { email },
      select: expectedRole === 'USER'
        ? { id: true, status: true, passwordHash: true, managerId: true }
        : { id: true },
    }),
  ])

  const matches = [admin, manager, user].filter(Boolean)
  if (matches.length !== 1) {
    return { account: null, collision: matches.length > 1 }
  }

  if (expectedRole === 'ADMIN' && admin && 'status' in admin && 'passwordHash' in admin) {
    const selectedAdmin = admin as { id: string; status: LoginAccount['status']; passwordHash: string }
    return {
      account: { ...selectedAdmin, role: 'ADMIN' },
      collision: false,
    }
  }
  if (expectedRole === 'MANAGER' && manager && 'status' in manager && 'passwordHash' in manager) {
    const selectedManager = manager as { id: string; status: LoginAccount['status']; passwordHash: string }
    return {
      account: { ...selectedManager, role: 'MANAGER' },
      collision: false,
    }
  }
  if (expectedRole === 'USER' && user && 'status' in user && 'passwordHash' in user && 'managerId' in user) {
    const selectedUser = user as { id: string; status: LoginAccount['status']; passwordHash: string; managerId: string }
    return {
      account: { ...selectedUser, role: 'USER' },
      collision: false,
    }
  }

  // A sole account under another role must not authenticate in this portal.
  return { account: null, collision: false }
}

export async function verifyLoginAccount(
  account: LoginAccount | null,
  expectedRole: LoginRole,
  password: string,
  comparePassword: (plainText: string, passwordHash: string) => Promise<boolean>,
) {
  return Boolean(
    account &&
    account.status === 'ACTIVE' &&
    account.role === expectedRole &&
    await comparePassword(password, account.passwordHash)
  )
}
