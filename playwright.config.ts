import { readFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from '@playwright/test'

const localEnvPath = path.join(process.cwd(), '.env.local.test')
const e2eSecretsPath = path.join(process.cwd(), '.env.local.e2e')
try {
  const e2eSecrets = readFileSync(e2eSecretsPath, 'utf8')
  for (const line of e2eSecrets.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
    }
  }
} catch {
  throw new Error('Playwright E2E requires .env.local.e2e; run the local E2E setup script first.')
}

let localTestDatabaseUrl: string | undefined
try {
  const localEnv = readFileSync(localEnvPath, 'utf8')
  localTestDatabaseUrl = localEnv.match(/^\s*LOCAL_TEST_DATABASE_URL\s*=\s*(.*?)\s*$/m)?.[1]
    ?.replace(/^(['"])(.*)\1$/, '$2')
} catch {
  throw new Error('Playwright E2E requires .env.local.test with LOCAL_TEST_DATABASE_URL for the disposable local database.')
}

if (!localTestDatabaseUrl) {
  throw new Error('Playwright E2E requires LOCAL_TEST_DATABASE_URL in .env.local.test.')
}

let databaseUrl: URL
try {
  databaseUrl = new URL(localTestDatabaseUrl)
} catch {
  throw new Error('LOCAL_TEST_DATABASE_URL must be a valid PostgreSQL URL for local E2E testing.')
}

const localHosts = new Set(['localhost', '127.0.0.1', '::1'])
const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ''))
if (
  !['postgres:', 'postgresql:'].includes(databaseUrl.protocol) ||
  !localHosts.has(databaseUrl.hostname.toLowerCase().replace(/^\[|\]$/g, '')) ||
  databaseName !== 'housingpro_test'
) {
  throw new Error('Refusing to run E2E: LOCAL_TEST_DATABASE_URL must target the local housingpro_test PostgreSQL database.')
}

const requiredSecrets = [
  'E2E_ADMIN_PASSWORD',
  'E2E_MANAGER_PASSWORD',
  'E2E_USER_PASSWORD',
  'E2E_MANAGER_ACCESS_TOKEN',
  'E2E_USER_ACCESS_TOKEN',
] as const
const missingSecrets = requiredSecrets.filter((key) => !process.env[key]?.trim())
if (missingSecrets.length) {
  throw new Error(`Playwright E2E requires local environment variables: ${missingSecrets.join(', ')}.`)
}

if (!/^[a-f0-9]{64}$/i.test(process.env.E2E_MANAGER_ACCESS_TOKEN!)) {
  throw new Error('E2E_MANAGER_ACCESS_TOKEN must be a 64-character access token configured for the local test database.')
}
if (!/^[a-f0-9]{64}$/i.test(process.env.E2E_USER_ACCESS_TOKEN!)) {
  throw new Error('E2E_USER_ACCESS_TOKEN must be a 64-character access token configured for the local test database.')
}

const testPort = Number(process.env.PLAYWRIGHT_PORT || '3100')
if (!Number.isInteger(testPort) || testPort < 1024 || testPort > 65535) {
  throw new Error('PLAYWRIGHT_PORT must be a valid local TCP port.')
}
const baseURL = `http://127.0.0.1:${testPort}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'off',
  },
  webServer: {
    command: `node ./node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${testPort}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      DATABASE_URL: localTestDatabaseUrl,
    },
  },
})
