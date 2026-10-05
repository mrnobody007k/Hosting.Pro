#!/usr/bin/env tsx
/**
 * Provision Super Admin using Netlify environment variables
 */

import { execSync } from 'child_process'
import { assertProductionAdminProvisioningOptIn } from '../lib/seed-safety'

async function provisionSuperAdmin() {
  // Require an explicit local opt-in before the external CLI can read deployment env.
  const productionOptIn = process.env.ALLOW_HOUSINGPRO_PRODUCTION_SEED
  assertProductionAdminProvisioningOptIn(process.env)

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
      if (!['ALLOW_HOUSINGPRO_PRODUCTION_SEED', 'NODE_ENV'].includes(key) && value && typeof value === 'string') {
        process.env[key] = value
      }
    }

    // Keep the operator's local confirmation; never trust a remote value for the gate.
    process.env.ALLOW_HOUSINGPRO_PRODUCTION_SEED = productionOptIn
    
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
    console.error('Failed to run provisioning:', error instanceof Error ? error.message : 'Unknown error')
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
