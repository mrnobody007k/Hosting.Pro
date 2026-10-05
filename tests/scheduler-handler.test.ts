import assert from 'node:assert/strict'
import test from 'node:test'
import { handleSchedulerRequest } from '../lib/scheduler-handler'

const secret = 'test-only-scheduler-secret-with-more-than-32-bytes'

function request(authorization?: string) {
  return new Request('https://housing-pro.vercel.app/api/internal/scheduler/process', {
    method: 'POST',
    headers: authorization ? { authorization } : {},
  })
}

test('unconfigured and unauthorized scheduler requests never invoke job callbacks', async () => {
  let calls = 0
  const runJobs = async () => { calls += 1; return { ok: true } }

  assert.deepEqual(await handleSchedulerRequest(request(`Bearer ${secret}`), undefined, runJobs), {
    status: 503,
    body: { error: 'Service unavailable.' },
  })
  assert.deepEqual(await handleSchedulerRequest(request('Bearer wrong'), secret, runJobs), {
    status: 401,
    body: { error: 'Unauthorized.' },
  })
  assert.equal(calls, 0)
})

test('authorized scheduler requests invoke jobs and preserve success or partial-failure status', async () => {
  let calls = 0
  const success = await handleSchedulerRequest(request(`Bearer ${secret}`), secret, async () => {
    calls += 1
    return { ok: true, daily: { failed: 0 }, rerent: { failed: 0 } }
  })
  assert.equal(success.status, 200)
  assert.deepEqual(success.body, { ok: true, daily: { failed: 0 }, rerent: { failed: 0 } })

  const partialFailure = await handleSchedulerRequest(request(`Bearer ${secret}`), secret, async () => ({
    ok: false,
    daily: { failed: 1, error: 'UNAVAILABLE' },
    rerent: { failed: 0 },
  }))
  assert.equal(partialFailure.status, 503)
  assert.equal(calls, 1)
})
