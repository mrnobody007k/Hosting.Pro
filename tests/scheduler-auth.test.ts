import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import test from 'node:test'
import { authorizeSchedulerRequest } from '../lib/scheduler-auth'

test('scheduler authentication rejects missing, short, and invalid bearer credentials', () => {
  const original = process.env.SCHEDULER_SERVICE_SECRET
  try {
    delete process.env.SCHEDULER_SERVICE_SECRET
    assert.deepEqual(authorizeSchedulerRequest(new Request('http://localhost/api/internal/scheduler/process')), {
      configured: false,
      authorized: false,
    })

    process.env.SCHEDULER_SERVICE_SECRET = 'too-short'
    assert.equal(authorizeSchedulerRequest(new Request('http://localhost', {
      headers: { authorization: 'Bearer too-short' },
    })).configured, false)

    const expected = randomBytes(32).toString('hex')
    process.env.SCHEDULER_SERVICE_SECRET = expected
    assert.deepEqual(authorizeSchedulerRequest(new Request('http://localhost', {
      headers: { authorization: `Bearer ${randomBytes(32).toString('hex')}` },
    })), { configured: true, authorized: false })
    assert.deepEqual(authorizeSchedulerRequest(new Request('http://localhost')), {
      configured: true,
      authorized: false,
    })
  } finally {
    if (original === undefined) delete process.env.SCHEDULER_SERVICE_SECRET
    else process.env.SCHEDULER_SERVICE_SECRET = original
  }
})

test('scheduler authentication accepts the configured bearer token', () => {
  const original = process.env.SCHEDULER_SERVICE_SECRET
  const expected = randomBytes(32).toString('hex')
  try {
    process.env.SCHEDULER_SERVICE_SECRET = expected
    assert.deepEqual(authorizeSchedulerRequest(new Request('http://localhost', {
      method: 'POST',
      headers: { authorization: `Bearer ${expected}` },
    })), { configured: true, authorized: true })
  } finally {
    if (original === undefined) delete process.env.SCHEDULER_SERVICE_SECRET
    else process.env.SCHEDULER_SERVICE_SECRET = original
  }
})
