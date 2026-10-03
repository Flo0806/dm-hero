import type { H3Event } from 'h3'

// Simple in-memory fixed window per key - enough for a single relay instance
const windows = new Map<string, { count: number, resetAt: number }>()

export function rateLimit(event: H3Event, scope: string, limit: number, windowMs: number) {
  const key = `${scope}:${getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'}`
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
