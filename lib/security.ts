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

  const text = await req.text()

  if (
    new TextEncoder().encode(text).byteLength >
    maxBytes
  ) {
    throw new RequestSecurityError(
      'Request body is too large.',
      413,
    )
  }

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

  const configuredOrigin =
    process.env.PUBLIC_APP_URL?.trim()

  let expectedOrigin: string

  if (configuredOrigin) {
    try {
      expectedOrigin =
        new URL(
          configuredOrigin,
        ).origin
    } catch {
      throw new RequestSecurityError(
        'Server origin configuration is invalid.',
        500,
      )
    }
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
  if (
    process.env.TRUST_PROXY ===
    'true'
  ) {
    const forwarded =
      req.headers.get(
        'x-forwarded-for',
      )

    if (forwarded) {
      return forwarded
        .split(',')[0]
        .trim()
        .slice(0, 100)
    }

    const realIp =
      req.headers.get(
        'x-real-ip',
      )

    if (realIp) {
      return realIp
        .trim()
        .slice(0, 100)
    }
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

