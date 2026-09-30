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

export function getClientDay(approvedAt: Date | null, createdAt: Date, now = new Date()) {
  return Math.max(1, dayNumber(now) - dayNumber(approvedAt || createdAt) + 1)
}
