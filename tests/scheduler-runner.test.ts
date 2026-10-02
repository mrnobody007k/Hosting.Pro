import assert from 'node:assert/strict'
import test from 'node:test'
import { runIndependentSchedulerJobs } from '../lib/scheduler-runner'

test('a daily job failure does not prevent the Re-Rent job from running', async () => {
  let rerentRan = false
  const result = await runIndependentSchedulerJobs(
    async () => { throw new Error('private implementation detail') },
    async () => { rerentRan = true; return { failed: 0, processed: 1 } },
  )

  assert.equal(rerentRan, true)
  assert.deepEqual(result, {
    ok: false,
    daily: { failed: 1, error: 'UNAVAILABLE' },
    rerent: { failed: 0, processed: 1 },
  })
  assert.equal(JSON.stringify(result).includes('private implementation detail'), false)
})

test('a Re-Rent job failure does not undo a successful daily batch', async () => {
  let dailyRan = false
  const result = await runIndependentSchedulerJobs(
    async () => { dailyRan = true; return { failed: 0, processed: 2 } },
    async () => { throw new Error('private implementation detail') },
  )

  assert.equal(dailyRan, true)
  assert.deepEqual(result, {
    ok: false,
    daily: { failed: 0, processed: 2 },
    rerent: { failed: 1, error: 'UNAVAILABLE' },
  })
})
