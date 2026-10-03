// Derived from Nitro's own h3 functions - always the h3 version that actually runs
type H3Event = Parameters<typeof getHeader>[0]

// Simple in-memory fixed window per key - enough for a single relay instance
const windows = new Map<string, { count: number, resetAt: number }>()

/**
 * Limit per client IP - or per given key (e.g. a game code, across all IPs).
 * X-Forwarded-For is only trusted behind a known proxy (NUXT_TRUST_PROXY=true),
 * otherwise anyone could fake a new IP per request.
 */
export function rateLimit(event: H3Event, scope: string, limit: number, windowMs: number, subject?: string) {
  // Nuxt turns NUXT_TRUST_PROXY=true into a real boolean
  const ip = getRequestIP(event, { xForwardedFor: useRuntimeConfig().trustProxy === true })
  const key = `${scope}:${subject ?? ip ?? 'unknown'}`
  const now = Date.now()
  const entry = windows.get(key)
  if (!entry || entry.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  entry.count++
  if (entry.count > limit) {
    setResponseHeader(event, 'Retry-After', Math.ceil((entry.resetAt - now) / 1000))
    throw createError({ statusCode: 429, message: 'Too many attempts, try again later' })
  }
}
