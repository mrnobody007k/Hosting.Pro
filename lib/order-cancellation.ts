export const MANAGER_CANCELLABLE_ORDER_STATUSES = [
  'PAYMENT_PENDING',
  'PAYMENT_SUBMITTED',
  'PAYMENT_VERIFIED',
  'ACTIVE',
  'RE_RENT_PENDING',
] as const

/** Status guard for the existing Manager-only order cancellation action. */
export function canManagerCancelOrderStatus(status: string): boolean {
  return MANAGER_CANCELLABLE_ORDER_STATUSES.includes(status as typeof MANAGER_CANCELLABLE_ORDER_STATUSES[number])
}
