const KEY_PREFIX = 'housingpro:wallet-booking:'
const fallbackKeys = new Map<string, string>()

function makeRequestId() {
  return crypto.randomUUID()
}

function storageKey(propertyId: string) {
  return `${KEY_PREFIX}${encodeURIComponent(propertyId)}`
}

/** Keep the same request ID until a booking succeeds so retries replay it. */
export function getWalletBookingRequestId(propertyId: string) {
  const key = storageKey(propertyId)
  try {
    const existing = window.localStorage.getItem(key)
    if (existing) return existing
    const requestId = makeRequestId()
    window.localStorage.setItem(key, requestId)
    return requestId
  } catch {
    const existing = fallbackKeys.get(key)
    if (existing) return existing
    const requestId = makeRequestId()
    fallbackKeys.set(key, requestId)
    return requestId
  }
}

export function clearWalletBookingRequestId(propertyId: string, requestId: string) {
  const key = storageKey(propertyId)
  fallbackKeys.delete(key)
  try {
    if (window.localStorage.getItem(key) === requestId) window.localStorage.removeItem(key)
  } catch {
    // The in-memory fallback is already cleared; the next request will create a new key.
  }
}
