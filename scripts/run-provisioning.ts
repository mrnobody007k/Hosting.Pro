#!/usr/bin/env tsx
/**
 * Run Super Admin provisioning with Netlify environment variables
 */

import { execSync } from 'child_process'

async function runProvisioning() {
  console.log('Fetching production environment variables from Netlify...')
  
  try {
    // Get environment variables from Netlify
    const envOutput = execSync('npx netlify env:list --json', { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    })
    const envVars = JSON.parse(envOutput.toString().trim())
    
    // Set environment variables
    for (const [key, value] of Object.entries(envVars)) {
      if (value && typeof value === 'string') {
        process.env[key] = value
      }
    }
    
    // Ensure required variables are present
    const required = ['DATABASE_URL', 'SUPER_ADMIN_EMAIL', 'SUPER_ADMIN_NAME', 'SUPER_ADMIN_PASSWORD', 'SEED_PASSWORD']
    const missing = required.filter(key => !process.env[key])
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
    }
    
    console.log('Environment variables loaded successfully')
    console.log('Running Super Admin provisioning...')
    
    // Run the provisioning script
    require('./provision-super-admin')
    
  } catch (error) {
    console.error('Failed to run provisioning:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  import('./provision-super-admin').catch(console.error)
}