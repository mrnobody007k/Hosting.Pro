#!/usr/bin/env tsx
/**
 * Fix Super Admin Email Mismatch
 * 
 * Updates the Super Admin email to match SUPER_ADMIN_EMAIL env var
 * and ensures password hash matches SUPER_ADMIN_PASSWORD.
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function fixSuperAdminEmail() {
  console.log('Fixing Super Admin email mismatch...')
  
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL
  const superAdminName = process.env.SUPER_ADMIN_NAME
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD

  if (!superAdminEmail || !superAdminName || !superAdminPassword) {
    throw new Error('SUPER_ADMIN_EMAIL, SUPER_ADMIN_NAME, and SUPER_ADMIN_PASSWORD must be set')
  }

  if (superAdminPassword.length < 12) {
    throw new Error('SUPER_ADMIN_PASSWORD must be at least 12 characters')
  }

  const prisma = new PrismaClient()

  try {
    console.log('Connecting to database...')
    
    // Find any existing Super Admin
    const existingSuperAdmin = await prisma.adminUser.findFirst({
      where: { adminType: 'SUPER_ADMIN' },
      select: { id: true, email: true, name: true, passwordHash: true, adminType: true, permissions: true },
    })

    if (!existingSuperAdmin) {
      console.log('No Super Admin found. Creating new one...')
      const superAdminHash = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD!, 12)
      await prisma.adminUser.create({
        data: {
          name: process.env.SUPER_ADMIN_NAME!,
          email: process.env.SUPER_ADMIN_EMAIL!,
          passwordHash: superAdminHash,
          adminType: 'SUPER_ADMIN',
          permissions: [],
        },
      })
      console.log(`Created new Super Admin: ${process.env.SUPER_ADMIN_EMAIL}`)
      return { action: 'created', email: process.env.SUPER_ADMIN_EMAIL! }
    }

    console.log(`Found existing Super Admin: ${existingSuperAdmin.email} (${existingSuperAdmin.adminType})`)

    const targetEmail = process.env.SUPER_ADMIN_EMAIL!
    const needsEmailUpdate = existingSuperAdmin.email !== targetEmail
    const needsPasswordUpdate = !await bcrypt.compare(process.env.SUPER_ADMIN_PASSWORD!, existingSuperAdmin.passwordHash)

    if (needsEmailUpdate) {
      console.log(`Updating email from ${existingSuperAdmin.email} to ${targetEmail}`)
      await prisma.adminUser.update({
        where: { id: existingSuperAdmin.id },
        data: { email: targetEmail },
      })
    }

    if (!needsEmailUpdate && !await bcrypt.compare(process.env.SUPER_ADMIN_PASSWORD!, existingSuperAdmin.passwordHash)) {
      console.log('Updating password hash...')
      await prisma.adminUser.update({
        where: { id: existingSuperAdmin.id },
        data: { passwordHash: await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD!, 12) },
      })
    }

    // Ensure adminType is SUPER_ADMIN
    if (existingSuperAdmin.adminType !== 'SUPER_ADMIN') {
      await prisma.adminUser.update({
        where: { id: existingSuperAdmin.id },
        data: { adminType: 'SUPER_ADMIN' },
      })
      console.log('Fixed adminType to SUPER_ADMIN')
    }

    // Verify final state
    const updated = await prisma.adminUser.findUnique({
      where: { id: existingSuperAdmin.id },
      select: { email: true, adminType: true, passwordHash: true, permissions: true },
    })

    const passwordVerified = await bcrypt.compare(process.env.SUPER_ADMIN_PASSWORD!, updated!.passwordHash)
    
    console.log(`✅ Super Admin fixed:`)
    console.log(`  Email: ${updated!.email} (expected: ${targetEmail})`)
    console.log(`  Admin Type: ${updated!.adminType} (expected: SUPER_ADMIN)`)
    console.log(`  Password verified: ${passwordVerified}`)
    console.log(`  Permissions: ${JSON.stringify(updated!.permissions)}`)

    if (updated!.email !== targetEmail || updated!.adminType !== 'SUPER_ADMIN' || !passwordVerified) {
      throw new Error('Verification failed')
    }

    return { action: 'fixed', email: updated!.email, passwordVerified }
    
  } catch (error) {
    console.error('❌ Fix failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  fixSuperAdminEmail()
    .then(result => {
      console.log('\n✅ Super Admin email fix completed successfully')
      console.log(JSON.stringify(result, null, 2))
      process.exit(0)
    })
    .catch(error => {
      console.error('Fix failed:', error)
      process.exit(1)
    }
  );
}

export { fixSuperAdminEmail }