/**
 * Pick a deterministic rotating offset for a bounded scheduler page.
 * Advancing by one batch per minute makes a fixed set of candidates cycle
 * through every position without a persisted cursor.
 */
export function getSchedulerWindowOffset(now: Date, candidateCount: number, batchSize: number) {
  if (!Number.isInteger(candidateCount) || candidateCount <= 0) return 0
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error('Scheduler batch size must be a positive integer.')
  }

  const minuteSlot = BigInt(Math.floor(now.getTime() / 60_000))
  return Number((minuteSlot * BigInt(batchSize)) % BigInt(candidateCount))
}

/** Read a bounded page at offset, wrapping to the beginning when necessary. */
export async function findRotatingWindow<T extends { id: string }>(input: {
  count: number
  batchSize: number
  offset: number
  findMany(args: { skip?: number; take: number }): Promise<T[]>
}) {
  if (input.count <= 0) return []

  const first = await input.findMany({ skip: input.offset, take: input.batchSize })
  const remaining = input.batchSize - first.length
  if (remaining <= 0 || input.offset === 0) return first

  const seen = new Set(first.map((item) => item.id))
  const wrapped = await input.findMany({ take: remaining })
  return [...first, ...wrapped.filter((item) => !seen.has(item.id))].slice(0, input.batchSize)
}
