import { timingSafeEqual } from 'node:crypto'

export function authorizeSchedulerRequest(
  request: Request,
  expectedToken = process.env.SCHEDULER_SERVICE_SECRET,
) {
  if (!expectedToken || Buffer.byteLength(expectedToken, 'utf8') < 32) {
    return { configured: false, authorized: false }
  }

  const match = /^Bearer ([^\s]+)$/.exec(request.headers.get('authorization') || '')
  if (!match) return { configured: true, authorized: false }

  const expected = Buffer.from(expectedToken, 'utf8')
  const provided = Buffer.from(match[1], 'utf8')
  return {
    configured: true,
    authorized: expected.length === provided.length && timingSafeEqual(expected, provided),
  }
}
