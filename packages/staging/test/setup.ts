import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { vi } from 'vitest'

// Nitro auto-imports, as the relay code expects them (globals)
const dir = mkdtempSync(join(tmpdir(), 'dm-hero-relay-'))
export const runtimeConfig = {
  databasePath: join(dir, 'relay.db'),
  filesDir: join(dir, 'files'),
  trustProxy: false as boolean,
  gameTtlDays: 30,
  sessionTtlDays: 90,
}

const cookies = new Map<string, string>()
const g = globalThis as Record<string, unknown>
g.useRuntimeConfig = () => runtimeConfig
g.createError = (o: { statusCode: number, message: string }) => Object.assign(new Error(o.message), { statusCode: o.statusCode })
g.getCookie = (_event: unknown, name: string) => cookies.get(name)
g.setCookie = vi.fn((_event: unknown, name: string, value: string) => cookies.set(name, value))
g.getHeader = (event: { headers?: Record<string, string> }, name: string) => event.headers?.[name]
g.setResponseHeader = () => {}
g.defineEventHandler = (handler: unknown) => handler
g.getRouterParam = (event: { params?: Record<string, string> }, name: string) => event.params?.[name]
g.readBody = async (event: { body?: unknown }) => event.body
g.getRequestIP = (event: { ip?: string, headers?: Record<string, string> }, options?: { xForwardedFor?: boolean }) =>
  (options?.xForwardedFor && event.headers?.['x-forwarded-for']) || event.ip

// The relay utils use each other as auto-imports too
const modules = await Promise.all([
  import('../server/utils/database'),
  import('../server/utils/tokens'),
  import('../server/utils/presence'),
  import('../server/utils/files'),
  import('../server/utils/auth'),
  import('../server/utils/rateLimit'),
  import('../server/utils/cleanup'),
])
for (const mod of modules) Object.assign(g, mod)

export const testCookies = cookies
