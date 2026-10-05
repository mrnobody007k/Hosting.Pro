import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const homepage = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8')
const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8')

test('homepage and metadata use the approved Housing.pro tagline and slogan', () => {
  assert.match(layout, /title:\s*'Housing\.pro — Online Property Rental & Re-Rental Marketplace'/)
  assert.match(layout, /description:\s*'Online Property Rental & Re-Rental Marketplace'/)
  assert.match(homepage, /<h1 id="home-title">Discover\. Rent\. <span>Re-Rent\.<\/span><\/h1>/)
  assert.doesNotMatch(homepage, /Rent\. Re-Rent\.\s*<span>Earn\.<\/span>/)
})

test('public rental calls to action do not link guests to a protected user page', () => {
  assert.match(homepage, /href="\/register" className="hp-home-primary"/)
  assert.match(homepage, /href="\/login" className="hp-home-bottom-link"/)
  assert.doesNotMatch(homepage, /href="\/user\/properties"/)
})
