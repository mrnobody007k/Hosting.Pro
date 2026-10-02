import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const supportPage = readFileSync(new URL('../app/user/support/page.tsx', import.meta.url), 'utf8')

test('support page states the configured contact limitation without inventing contact details', () => {
  assert.match(supportPage, /No in-app support contact is configured yet\./)
  assert.match(supportPage, /If you have received Housing\.pro support contact details, include your booking code when you reach out\./)
  assert.doesNotMatch(supportPage, /payment (?:help|support) (?:phone|email|number)/i)
})
