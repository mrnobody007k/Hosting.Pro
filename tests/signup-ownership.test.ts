import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const registrationRoute = readFileSync(new URL('../app/api/user/register/route.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('signup derives client ownership only from an active referral code', () => {
  const referralLookup = registrationRoute.indexOf('where: {\n                referralCode,')
  const activeCheck = registrationRoute.indexOf("manager.status !==\n              'ACTIVE'", referralLookup)
  const userCreate = registrationRoute.indexOf('await tx.user.create', activeCheck)

  assert.ok(referralLookup >= 0)
  assert.ok(activeCheck > referralLookup)
  assert.ok(userCreate > activeCheck)
  assert.match(registrationRoute.slice(userCreate, userCreate + 900), /managerId:\s*manager\.id/)
  assert.doesNotMatch(registrationRoute.slice(0, registrationRoute.indexOf('const referralCode')), /managerId\??:/)
})
