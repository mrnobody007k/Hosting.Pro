#!/usr/bin/env tsx
/**
 * Production Super Admin Provisioning Script
 * 
 * Idempotent script to ensure the Super Admin account exists with the correct
 * password hash matching SUPER_ADMIN_PASSWORD environment variable.
 * 
 * This script ONLY affects the Super Admin record (adminType: SUPER_ADMIN).
 * It does NOT create or modify any other users, managers, clients, or data.
 * 
 * Environment variables required:
 * - DATABASE_URL: PostgreSQL connection string
 * - SUPER_ADMIN_EMAIL: Email for the Super Admin account
 * - SUPER_ADMIN_NAME: Display name for the Super Admin
 * - SUPER_ADMIN_PASSWORD: Password for the Super Admin (min 12 chars)
 * 
 * Usage: tsx scripts/provision-super-admin.ts
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function provisionSuperAdmin() {
  console.log('Starting Super Admin provisioning...')
  
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL
  const superAdminName = process.env.SUPER_ADMIN_NAME
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD

  // Validate required environment variables
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required')
  }
  
  if (!superAdminEmail || !superAdminName || !superAdminPassword) {
    throw new Error('SUPER_ADMIN_EMAIL, SUPER_ADMIN_NAME, and SUPER_ADMIN_PASSWORD environment variables are required')
  }

  if (superAdminPassword.length < 12) {
    throw new Error('SUPER_ADMIN_PASSWORD must be at least 12 characters')
  }

  const prisma = new PrismaClient()

  try {
    console.log('Connecting to database...')
    
    // Find existing Super Admin
    const existingSuperAdmin = await prisma.adminUser.findFirst({
      where: { adminType: 'SUPER_ADMIN' },
      select: { id: true, email: true, name: true, passwordHash: true, adminType: true, permissions: true },
    })

    if (existingSuperAdmin) {
      console.log(`Found existing Super Admin: ${existingSuperAdmin.email} (${existingSuperAdmin.adminType})`)
      
      // Verify password hash matches current SUPER_ADMIN_PASSWORD
      const passwordMatches = await bcrypt.compare(process.env.SUPER_ADMIN_PASSWORD!, existingSuperAdmin.passwordHash)
      
      if (!passwordMatches) {
        console.log('Password hash does not match current SUPER_ADMIN_PASSWORD. Updating...')
        const superAdminHash = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD!, 12)
        await prisma.adminUser.update({
          where: { id: existingSuperAdmin.id },
          data: { passwordHash: await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD!, 12) },
        })
        console.log(`✅ Super Admin password updated for: ${existingSuperAdmin.email}`)
      } else {
        console.log(`✅ Super Admin password is already up to date for: ${existingSuperAdmin.email}`)
      }
      
      // Verify role and permissions are correct
      if (existingSuperAdmin.adminType !== 'SUPER_ADMIN') {
        await prisma.adminUser.update({
          where: { id: existingSuperAdmin.id },
          data: { adminType: 'SUPER_ADMIN' },
        })
        console.log(`Fixed adminType to SUPER_ADMIN for: ${existingSuperAdmin.email}`)
      }
      
      // Ensure permissions array exists (though empty is fine for SUPER_ADMIN)
      if (!existingSuperAdmin.permissions || !Array.isArray(existingSuperAdmin.permissions)) {
        await prisma.adminUser.update({
          where: { id: existingSuperAdmin.id },
          data: { permissions: [] },
        })
        console.log('Fixed permissions array for Super Admin')
      }
      
      console.log(`✅ Super Admin ${existingSuperAdmin.email} is properly configured`)
      return { action: 'updated', email: existingSuperAdmin.email }
    }

    // No Super Admin exists - create one
    console.log('No Super Admin found. Creating new Super Admin...')
    
    const superAdminHash = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD!, 12)
    
    const newSuperAdmin = await prisma.adminUser.create({
      data: {
        name: process.env.SUPER_ADMIN_NAME!,
        email: process.env.SUPER_ADMIN_EMAIL!,
        passwordHash: await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD!, 12),
        adminType: 'SUPER_ADMIN',
        permissions: [],
      },
    })
    
    console.log(`✅ Created new Super Admin: ${process.env.SUPER_ADMIN_EMAIL}`)
    return { action: 'created', email: process.env.SUPER_ADMIN_EMAIL! }
    
  } catch (error) {
    console.error('❌ Super Admin provisioning failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run if executed directly
if (require.main === module) {
  provisionSuperAdmin()
    .then(result => {
      console.log('\n✅ Super Admin provisioning completed successfully')
      console.log(JSON.stringify(result, null, 2))
      process.exit(0)
    })
    .catch(error => {
      console.error('Provisioning failed:', error)
      process.exit(1)
    })
}

export { provisionSuperAdmin }