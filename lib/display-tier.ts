export const DISPLAY_TIERS = ['GOLD', 'DIAMOND', 'MERCHANT'] as const

export type DisplayTier = (typeof DISPLAY_TIERS)[number]

export function isDisplayTier(value: unknown): value is DisplayTier {
  return typeof value === 'string' && DISPLAY_TIERS.includes(value as DisplayTier)
}

export function displayTierLabel(value: unknown): string {
  if (!isDisplayTier(value)) return 'Not assigned'
  return value.charAt(0) + value.slice(1).toLowerCase()
}

export function canAssignDisplayTier(session: {
  role?: string | null
  adminType?: string | null
  permissions?: string[] | null
} | null | undefined): boolean {
  return Boolean(
    session?.role === 'ADMIN' &&
    (session.adminType === 'SUPER_ADMIN' || session.permissions?.includes('MANAGE_USERS')),
  )
}
