import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { getPublicAppOrigin } from '../lib/security'

const exampleEnvironment = readFileSync(new URL('../.env.example', import.meta.url), 'utf8')

function withPublicAppUrl(value: string | undefined, run: () => void) {
  const original = process.env.PUBLIC_APP_URL
  if (value === undefined) delete process.env.PUBLIC_APP_URL
  else process.env.PUBLIC_APP_URL = value
  try { run() } finally {
    if (original === undefined) delete process.env.PUBLIC_APP_URL
    else process.env.PUBLIC_APP_URL = original
  }
}

test('optional PUBLIC_APP_URL stays unset in the copyable example configuration', () => {
  assert.match(exampleEnvironment, /^# Optional: leave unset when the request's public origin is reliable;/m)
  assert.match(exampleEnvironment, /^# PUBLIC_APP_URL="https:\/\//m)
  assert.doesNotMatch(exampleEnvironment, /^\s*PUBLIC_APP_URL\s*=/m)
})

test('public app URL accepts only a clean HTTPS origin and normalizes a trailing slash', () => {
  withPublicAppUrl(undefined, () => assert.equal(getPublicAppOrigin(), undefined))
  withPublicAppUrl(' https://housing-pro.vercel.app/ ', () => {
    assert.equal(getPublicAppOrigin(), 'https://housing-pro.vercel.app')
  })
  for (const value of ['http://housing-pro.vercel.app', 'https://housing-pro.vercel.app/path', 'https://user:pass@housing-pro.vercel.app']) {
    withPublicAppUrl(value, () => assert.throws(getPublicAppOrigin, /valid HTTPS origin/))
  }
})
