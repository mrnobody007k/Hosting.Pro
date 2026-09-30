import { createHash, randomBytes, timingSafeEqual } from 'crypto'

export function generateAccessToken(): string {
  return randomBytes(32).toString('hex')
}

export function validateAccessToken(token: string): boolean {
  if (!token || token.length !== 64) return false
  return /^[a-f0-9]{64}$/.test(token)
}

export function storeAccessToken(token: string): string {
  return `sha256:${createHash('sha256').update(token, 'utf8').digest('hex')}`
}

export function matchesAccessToken(token: unknown, storedToken: string | null | undefined): boolean {
  if (typeof token !== 'string' || !validateAccessToken(token) || !storedToken) return false
  const expected = storedToken.startsWith('sha256:')
    ? storedToken.slice('sha256:'.length)
    : storeAccessToken(storedToken).slice('sha256:'.length)
  const actual = createHash('sha256').update(token, 'utf8').digest()
  if (!/^[a-f0-9]{64}$/.test(expected)) return false
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'))
}
