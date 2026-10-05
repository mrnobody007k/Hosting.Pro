import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import test from 'node:test'
import TierBadge from '../app/user/TierBadge'
import { canAssignDisplayTier, displayTierLabel, isDisplayTier } from '../lib/display-tier'

test('only the three display tiers are accepted and labels stay informational', () => {
  assert.equal(isDisplayTier('GOLD'), true)
  assert.equal(isDisplayTier('DIAMOND'), true)
  assert.equal(isDisplayTier('MERCHANT'), true)
  assert.equal(isDisplayTier('DAY_2'), false)
  assert.equal(displayTierLabel('GOLD'), 'Gold')
  assert.equal(displayTierLabel('DIAMOND'), 'Diamond')
  assert.equal(displayTierLabel('MERCHANT'), 'Merchant')
})

test('tier assignment requires an Admin with MANAGE_USERS or a Super Admin', () => {
  assert.equal(canAssignDisplayTier({ role: 'ADMIN', adminType: 'STAFF_ADMIN', permissions: ['MANAGE_USERS'] }), true)
  assert.equal(canAssignDisplayTier({ role: 'ADMIN', adminType: 'SUPER_ADMIN', permissions: [] }), true)
  assert.equal(canAssignDisplayTier({ role: 'ADMIN', adminType: 'STAFF_ADMIN', permissions: [] }), false)
  assert.equal(canAssignDisplayTier({ role: 'MANAGER', permissions: ['MANAGE_USERS'] }), false)
  assert.equal(canAssignDisplayTier({ role: 'USER', permissions: ['MANAGE_USERS'] }), false)
  assert.equal(canAssignDisplayTier(null), false)
})

test('existing users remain explicitly unassigned without a legacy status mapping', () => {
  assert.equal(displayTierLabel(null), 'Not assigned')
  assert.equal(displayTierLabel(undefined), 'Not assigned')
  const migration = readFileSync(new URL('../prisma/migrations/20261002000000_user_display_tier/migration.sql', import.meta.url), 'utf8')
  assert.match(migration, /ADD COLUMN "displayTier" "DisplayTier";/)
  assert.doesNotMatch(migration, /DEFAULT|UPDATE\s+"User"/i)
})

test('tier badge renders the assigned value and an unassigned state', () => {
  assert.match(renderToStaticMarkup(TierBadge({ tier: 'DIAMOND' })), />\s*Diamond\s*</)
  assert.match(renderToStaticMarkup(TierBadge({ tier: null })), />\s*Not assigned\s*</)
})
