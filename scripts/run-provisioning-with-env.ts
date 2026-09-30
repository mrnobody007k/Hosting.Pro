#!/usr/bin/env tsx
/**
 * Provision Super Admin using Netlify environment variables
 */

import { execSync } from 'child_process'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function provisionSuperAdmin() {
  console.log('Fetching production environment variables from Netlify...')
  
  try {
    // Get environment variables from Netlify
    const envOutput = execSync('npx netlify env:get --json', { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    })
    
    const envVars = JSON.parse(envOutput.trim())
    
    // Set environment variables
    for (const [key, value] of Object.entries(envVars)) {
      if (value && typeof value === 'string') {
        process.env[key] = value
      }
    }
    
    // Verify required variables
    const required = ['DATABASE_URL', 'SUPER_ADMIN_EMAIL', 'SUPER_ADMIN_NAME', 'SUPER_ADMIN_PASSWORD']
    const missing = ['DATABASE_URL', 'SUPER_ADMIN_EMAIL', 'SUPER_ADMIN_NAME', 'SUPER_ADMIN_PASSWORD']
      .filter(key => !process.env[key])
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
    }
    
    console.log('Environment variables loaded from Netlify')
    console.log('Provisioning Super Admin...')
    
    const { provisionSuperAdmin } = await import('./provision-super-admin')
    await provisionSuperAdmin()
    
  } catch (error) {
    console.error('Failed to run provisioning:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  provisionSuperAdmin()
    .then(() => {
      console.log('\n✅ Provisioning completed successfully')
      process.exit(0)
    })
    .catch(error => {
      console.error('Provisioning failed:', error)
      process.exit(1)
    })
}