import assert from 'node:assert/strict'
import test from 'node:test'
import { getClientDayEligibilityCutoff, getClientDay } from '../lib/client-day'
import { findRotatingWindow, getSchedulerWindowOffset } from '../lib/scheduler-window'

test('daily progression cutoffs use the same Asia/Kolkata day boundaries as client day calculation', () => {
  const now = new Date('2026-09-30T06:30:00.000Z')
  const day2Cutoff = getClientDayEligibilityCutoff(2, now)
  const day3Cutoff = getClientDayEligibilityCutoff(3, now)

  assert.equal(day2Cutoff.toISOString(), '2026-09-29T18:30:00.000Z')
  assert.equal(day3Cutoff.toISOString(), '2026-09-28T18:30:00.000Z')
  assert.equal(getClientDay(day2Cutoff, day2Cutoff, now), 1)
  assert.equal(getClientDay(new Date(day2Cutoff.getTime() - 1), new Date(0), now), 2)
  assert.equal(getClientDay(new Date(day3Cutoff.getTime() - 1), new Date(0), now), 3)
})

test('deterministic rotating windows reach later candidates when earlier candidates keep failing', async () => {
  const candidateCount = 91
  const batchSize = 40
  const candidates = Array.from({ length: candidateCount }, (_, index) => ({ id: `candidate-${index}` }))
  const failedCandidates = new Set(candidates.map(({ id }) => id))
  const visited = new Set<string>()
  const firstSlot = new Date(1_800_000_000_000)

  for (let slot = 0; slot < candidateCount + 2 && visited.size < candidateCount; slot += 1) {
    const now = new Date(firstSlot.getTime() + slot * 60_000)
    const offset = getSchedulerWindowOffset(now, candidateCount, batchSize)
    const window = await findRotatingWindow({
      count: candidateCount,
      batchSize,
      offset,
      findMany: async ({ skip = 0, take }) => candidates.slice(skip, skip + take),
    })
    assert.ok(window.length <= batchSize)
    for (const candidate of window) visited.add(candidate.id)
  }

  assert.equal(visited.size, candidateCount)
  assert.equal(failedCandidates.size, candidateCount)
})

test('a failed candidate is selected again on a later rotation', async () => {
  const candidates = Array.from({ length: 81 }, (_, index) => ({ id: `candidate-${index}` }))
  const batchSize = 40
  const now = new Date(1_800_000_000_000)
  const firstOffset = getSchedulerWindowOffset(now, candidates.length, batchSize)
  const firstWindow = await findRotatingWindow({
    count: candidates.length,
    batchSize,
    offset: firstOffset,
    findMany: async ({ skip = 0, take }) => candidates.slice(skip, skip + take),
  })
  const failedId = firstWindow[0].id

  let retried = false
  for (let slot = 1; slot < candidates.length && !retried; slot += 1) {
    const offset = getSchedulerWindowOffset(new Date(now.getTime() + slot * 60_000), candidates.length, batchSize)
    const nextWindow = await findRotatingWindow({
      count: candidates.length,
      batchSize,
      offset,
      findMany: async ({ skip = 0, take }) => candidates.slice(skip, skip + take),
    })
    retried = nextWindow.some((candidate) => candidate.id === failedId)
  }

  assert.equal(retried, true)
})
