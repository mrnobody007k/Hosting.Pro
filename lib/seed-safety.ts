import type { Prisma } from '@prisma/client'

type SeedEnvironment = {
  NODE_ENV?: string
  DATABASE_URL?: string
  ALLOW_HOUSINGPRO_LOCAL_SEED?: string
  ALLOW_HOUSINGPRO_PRODUCTION_SEED?: string
}

type SuperAdminBootstrapInput = {
  email?: string
  name?: string
  password?: string
}

type BootstrapTransaction = Pick<Prisma.TransactionClient, 'adminUser' | 'manager' | 'user'>

export async function assertAdminBootstrapEmailAvailable(database: BootstrapTransaction, email: string, allowedAdminId?: string): Promise<void> {
  const [admin, manager, user] = await Promise.all([
    database.adminUser.findUnique({ where: { email }, select: { id: true } }),
    database.manager.findUnique({ where: { email }, select: { id: true } }),
    database.user.findUnique({ where: { email }, select: { id: true } }),
  ])
  if ((admin && admin.id !== allowedAdminId) || manager || user) {
    throw new Error('SUPER_ADMIN_EMAIL_ALREADY_IN_USE')
  }
}

export function normalizeSuperAdminBootstrap(input: SuperAdminBootstrapInput): SuperAdminBootstrapInput {
  const email = input.email?.trim().toLowerCase()
  const name = input.name?.trim()

  if (input.email !== undefined && (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new Error('SUPER_ADMIN_EMAIL must be a valid email address.')
  }
  if (input.name !== undefined && (!name || name.length > 120)) {
    throw new Error('SUPER_ADMIN_NAME must contain 1 to 120 characters.')
  }
  if (input.password !== undefined && input.password.length < 12) {
    throw new Error('SUPER_ADMIN_PASSWORD must be at least 12 characters.')
  }

  return { email, name, password: input.password }
}

/** Require a local, deliberate opt-in before fetching deployment credentials. */
export function assertProductionAdminProvisioningOptIn(environment: Pick<SeedEnvironment, 'NODE_ENV' | 'ALLOW_HOUSINGPRO_PRODUCTION_SEED'>): void {
  if (environment.NODE_ENV !== 'production') {
    throw new Error('Production Admin provisioning requires NODE_ENV=production.')
  }
  if (environment.ALLOW_HOUSINGPRO_PRODUCTION_SEED !== 'YES') {
    throw new Error('Explicit opt-in required: ALLOW_HOUSINGPRO_PRODUCTION_SEED=YES.')
  }
}

/** Existing Super Admin repair can change credentials; require a separate explicit opt-in. */
export function assertSuperAdminRepairOptIn(environment: { ALLOW_HOUSINGPRO_SUPER_ADMIN_REPAIR?: string }): void {
  if (environment.ALLOW_HOUSINGPRO_SUPER_ADMIN_REPAIR !== 'YES') {
    throw new Error('Explicit opt-in required: ALLOW_HOUSINGPRO_SUPER_ADMIN_REPAIR=YES.')
  }
}

/** Require an explicit opt-in and loopback PostgreSQL URL before demo seed writes. */
export function assertSafeDevelopmentSeedTarget(environment: SeedEnvironment): void {
  if (environment.NODE_ENV === 'production') {
    throw new Error('Development seed data is disabled in production.')
  }
  if (environment.ALLOW_HOUSINGPRO_LOCAL_SEED !== 'YES') {
    throw new Error('Explicit opt-in required: ALLOW_HOUSINGPRO_LOCAL_SEED=YES.')
  }

  let url: URL
  try {
    url = new URL(environment.DATABASE_URL ?? '')
  } catch {
    throw new Error('A valid loopback PostgreSQL DATABASE_URL is required for development seed data.')
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '::1'].includes(host) ||
    url.searchParams.has('host') ||
    url.searchParams.has('hostaddr')
  ) {
    throw new Error('Development seed data is restricted to loopback PostgreSQL targets.')
  }
}

/** Production seed writes are reserved for an explicitly authorized bootstrap. */
export function assertSeedExecutionAllowed(environment: SeedEnvironment): void {
  if (environment.NODE_ENV !== 'production') {
    assertSafeDevelopmentSeedTarget(environment)
    return
  }

  if (environment.ALLOW_HOUSINGPRO_PRODUCTION_SEED !== 'YES') {
    throw new Error('Explicit opt-in required: ALLOW_HOUSINGPRO_PRODUCTION_SEED=YES.')
  }

  let url: URL
  try {
    url = new URL(environment.DATABASE_URL ?? '')
  } catch {
    throw new Error('A valid PostgreSQL DATABASE_URL is required for production bootstrap.')
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.searchParams.has('host') ||
    url.searchParams.has('hostaddr')
  ) {
    throw new Error('Production bootstrap requires a PostgreSQL URL without host overrides.')
  }
}
