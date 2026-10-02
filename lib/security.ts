import { Decimal } from 'decimal.js'

const DEFAULT_MAX_BODY_BYTES = 256 * 1024

export class RequestSecurityError extends Error {
  status: number

  constructor(
    message: string,
    status = 400,
  ) {
    super(message)
    this.status = status
  }
}

/** Return the configured public origin after rejecting anything beyond an HTTPS origin. */
export function getPublicAppOrigin() {
  const configured = process.env.PUBLIC_APP_URL
  if (configured === undefined) return undefined

  const value = configured.trim()
  try {
    const url = new URL(value)
    if (
      url.protocol !== 'https:' ||
      !url.hostname ||
      url.username ||
      url.password ||
      (url.pathname !== '' && url.pathname !== '/') ||
      url.search ||
      url.hash
    ) {
      throw new Error('Invalid public origin')
    }
    return url.origin
  } catch {
    throw new RequestSecurityError(
      'Server origin configuration must be a valid HTTPS origin.',
      500,
    )
  }
}

export async function readJson<T = any>(
  req: Request,
  maxBytes = DEFAULT_MAX_BODY_BYTES,
): Promise<T> {
  const contentLength =
    req.headers.get('content-length')

  if (
    contentLength &&
    Number.isFinite(Number(contentLength)) &&
    Number(contentLength) > maxBytes
  ) {
    throw new RequestSecurityError(
      'Request body is too large.',
      413,
    )
  }

  const chunks: Uint8Array[] = []
  let totalBytes = 0
  const reader = req.body?.getReader()

  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        totalBytes += value.byteLength
        if (totalBytes > maxBytes) {
          await reader.cancel().catch(() => undefined)
          throw new RequestSecurityError('Request body is too large.', 413)
        }
        chunks.push(value)
      }
    } finally {
      reader.releaseLock()
    }
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  const text = new TextDecoder().decode(bytes)

  if (!text.trim()) {
    return {} as T
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new RequestSecurityError(
      'Invalid JSON request.',
      400,
    )
  }
}

/*
 * CSRF / Origin protection
 *
 * All state-changing requests that call this function
 * must originate from the same site.
 *
 * We prefer Origin because it is the strongest browser
 * signal for this purpose. Referer is accepted as a
 * fallback for clients that do not send Origin.
 *
 * PUBLIC_APP_URL can be set in production when the
 * deployment is behind a reverse proxy/CDN and the
 * externally visible origin differs from the internal
 * request host.
 */
export function requireSameOrigin(
  req: Request,
) {
  const method =
    req.method.toUpperCase()

  /*
   * Safe methods do not change server state.
   */
  if (
    method === 'GET' ||
    method === 'HEAD' ||
    method === 'OPTIONS'
  ) {
    return
  }

  const configuredOrigin = getPublicAppOrigin()

  let expectedOrigin: string

  if (configuredOrigin) {
    expectedOrigin = configuredOrigin
  } else {
    const host =
      req.headers.get('host')

    if (!host) {
      throw new RequestSecurityError(
        'Invalid request origin.',
        403,
      )
    }

    /*
     * In normal Next.js deployment, the request URL
     * reflects the current origin. This is preferable
     * to blindly trusting an arbitrary forwarded host.
     */
    try {
      expectedOrigin =
        new URL(req.url).origin
    } catch {
      throw new RequestSecurityError(
        'Invalid request origin.',
        403,
      )
    }

    /*
     * If the request URL does not match the Host header,
     * do not silently trust the mismatch.
     */
    let requestUrl: URL

    try {
      requestUrl = new URL(req.url)
    } catch {
      throw new RequestSecurityError(
        'Invalid request origin.',
        403,
      )
    }

    if (
      requestUrl.host !== host
    ) {
      /*
       * Reverse proxies can legitimately produce an
       * internal request URL. In that case production
       * should use PUBLIC_APP_URL.
       */
      if (
        process.env.NODE_ENV ===
        'production'
      ) {
        throw new RequestSecurityError(
          'Server origin configuration is required for this deployment.',
          500,
        )
      }

      /*
       * Development fallback:
       * use the Host header and request protocol.
       */
      const forwardedProto =
        req.headers.get(
          'x-forwarded-proto',
        )

      const protocol =
        forwardedProto === 'https'
          ? 'https'
          : requestUrl.protocol.replace(
              ':',
              '',
            ) === 'https'
            ? 'https'
            : 'http'

      expectedOrigin =
        `${protocol}://${host}`
    }
  }

  const origin =
    req.headers.get('origin')

  if (origin) {
    let receivedOrigin: string

    try {
      receivedOrigin =
        new URL(origin).origin
    } catch {
      throw new RequestSecurityError(
        'Invalid request origin.',
        403,
      )
    }

    if (
      receivedOrigin !==
      expectedOrigin
    ) {
      throw new RequestSecurityError(
        'Invalid request origin.',
        403,
      )
    }

    return
  }

  /*
   * Origin may be absent for some legitimate clients.
   * Use Referer as a strict same-origin fallback.
   */
  const referer =
    req.headers.get('referer')

  if (referer) {
    let receivedRefererOrigin: string

    try {
      receivedRefererOrigin =
        new URL(referer).origin
    } catch {
      throw new RequestSecurityError(
        'Invalid request origin.',
        403,
      )
    }

    if (
      receivedRefererOrigin !==
      expectedOrigin
    ) {
      throw new RequestSecurityError(
        'Invalid request origin.',
        403,
      )
    }

    return
  }

  /*
   * Neither Origin nor Referer exists.
   * For state-changing browser requests we do not
   * silently allow this anymore.
   */
  throw new RequestSecurityError(
    'Request origin could not be verified.',
    403,
  )
}

/*
 * Only trust forwarded client-IP headers when the
 * deployment explicitly enables trusted proxy handling.
 *
 * Otherwise use the direct request address header.
 */
export function getClientIp(
  req: Request,
) {
  const normalizeIp = (value: string | null) => {
    if (!value) return null
    const candidate = value.trim()
    if (!candidate || candidate.length > 100 || candidate.includes(',')) return null
    // Accept IPv4, IPv6, and IPv4-with-port values commonly used by proxies.
    if (/^(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?$/.test(candidate)) {
      const address = candidate.replace(/:\d{1,5}$/, '')
      if (address.split('.').every((part) => Number(part) <= 255)) return candidate
      return null
    }
    if (/^[0-9a-fA-F:]+$/.test(candidate) && candidate.includes(':')) return candidate
    return null
  }

  if (process.env.TRUST_PROXY === 'true') {
    // The leftmost forwarded address is safe only when the configured proxy
    // strips client-supplied X-Forwarded-For and writes its own value.
    const forwarded = normalizeIp(req.headers.get('x-forwarded-for')?.split(',')[0] ?? null)
    if (forwarded) return forwarded

    const realIp = normalizeIp(req.headers.get('x-real-ip'))
    if (realIp) return realIp
  }

  return 'unknown'
}

export function isValidEmail(
  email: string,
) {
  return (
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email,
    )
  )
}

export function validMoney(
  value: unknown,
  max = 100_000_000_000_000,
) {
  if (typeof value !== 'string') return null
  try {
    const amount = new Decimal(String(value).trim())
    if (!amount.isFinite() || !amount.gt(0) || amount.gt(new Decimal(String(max))) || amount.decimalPlaces() > 2) return null
    return amount
  } catch {
    return null
  }
}

export function isValidHttpsUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password
  } catch {
    return false
  }
}

export function handleRequestSecurityError(
  error: unknown,
) {
  if (
    error instanceof RequestSecurityError
  ) {
    return Response.json(
      {
        error: error.message,
      },
      {
        status: error.status,
      },
    )
  }

  return null
}
