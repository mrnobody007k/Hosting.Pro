const INDIA_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function dayNumber(value: Date) {
  const parts = Object.fromEntries(INDIA_DAY_FORMATTER.formatToParts(value).map(({ type, value: part }) => [type, part]))
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / 86_400_000
}

/**
 * Returns the exclusive UTC cutoff for approval/creation dates that make a
 * client eligible for `minimumDay`. Keep this tied to the same Asia/Kolkata
 * calendar-day calculation as getClientDay.
 */
export function getClientDayEligibilityCutoff(minimumDay: number, now = new Date()) {
  if (!Number.isInteger(minimumDay) || minimumDay < 1) {
    throw new Error('Minimum client day must be a positive integer.')
  }

  const exclusiveAnchorDay = dayNumber(now) - minimumDay + 2
  const localMidnightUtc = exclusiveAnchorDay * 86_400_000 - (5 * 60 + 30) * 60_000
  return new Date(localMidnightUtc)
}

export function getClientDay(approvedAt: Date | null, createdAt: Date, now = new Date()) {
  return Math.max(1, dayNumber(now) - dayNumber(approvedAt || createdAt) + 1)
}
