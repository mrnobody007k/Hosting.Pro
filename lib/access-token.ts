import { randomBytes } from 'crypto'

export function generateAccessToken(): string {
  return randomBytes(32).toString('hex')
}

export function validateAccessToken(token: string): boolean {
  if (!token || token.length !== 64) return false
  return /^[a-f0-9]{64}$/.test(token)
}