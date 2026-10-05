#!/usr/bin/env tsx
/**
 * One-time Super Admin bootstrap. Existing accounts are never modified here.
 * The target must pass the same explicit target guard used by the seed script.
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { assertAdminBootstrapEmailAvailable, assertSeedExecutionAllowed, normalizeSuperAdminBootstrap } from '../lib/seed-safety'

export async function provisionSuperAdmin() {
  // Refuse before constructing a client or making any database connection.
  assertSeedExecutionAllowed(process.env)
  const input = normalizeSuperAdminBootstrap({
    email: process.env.SUPER_ADMIN_EMAIL,
    name: process.env.SUPER_ADMIN_NAME,
    password: process.env.SUPER_ADMIN_PASSWORD,
  })
  if (!input.email || !input.name || !input.password) {
    throw new Error('SUPER_ADMIN_EMAIL, SUPER_ADMIN_NAME, and SUPER_ADMIN_PASSWORD are required.')
  }

  const prisma = new PrismaClient()
  try {
    const existing = await prisma.adminUser.findFirst({
      where: { adminType: 'SUPER_ADMIN' },
      select: { id: true },
    })
    if (existing) {
      return { action: 'already_exists' as const }
    }

    const passwordHash = await bcrypt.hash(input.password, 12)
    const created = await prisma.$transaction(async (tx) => {
      await assertAdminBootstrapEmailAvailable(tx, input.email!)
      return tx.adminUser.create({
        data: {
          name: input.name!,
          email: input.email!,
          passwordHash,
          adminType: 'SUPER_ADMIN',
          permissions: [],
        },
        select: { id: true },
      })
    })

    return { action: 'created' as const, id: created.id }
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  provisionSuperAdmin()
    .then((result) => {
      console.log(`Super Admin bootstrap result: ${result.action}`)
      process.exit(0)
    })
    .catch((error) => {
      console.error('Super Admin bootstrap failed:', error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    })
}
