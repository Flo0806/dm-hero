import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { getTestDb } from '../utils/test-db'
import { NAV_KEYS, normalizeNavLayout } from '../../types/navigation'

// The DM's sidebar order: stored in the settings, always complete and safe
let db: Database.Database

vi.mock('../../server/utils/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../server/utils/db')>()
  return { ...original, getDb: () => db }
})

let body: unknown
beforeAll(() => {
  const g = globalThis as Record<string, unknown>
  g.defineEventHandler = (handler: unknown) => handler
  g.readBody = async () => body
  g.createError = (o: { statusCode: number, message: string }) => Object.assign(new Error(o.message), { statusCode: o.statusCode })
})

beforeEach(() => {
  db = getTestDb()
})

async function call<T>(file: string, payload?: unknown): Promise<T> {
  body = payload
  const handler = (await import(`../../server/api/settings/navigation/${file}`)).default as (e: unknown) => unknown
  return await handler({}) as T
}

describe('navigation layout', () => {
  it('normalizing keeps known entries and dividers, drops junk, appends missing entries', () => {
    const layout = normalizeNavLayout(['maps', 'divider:a1', 'npcs', 'npcs', 'evil', 42, 'divider:<script>'])
    expect(layout.slice(0, 3)).toEqual(['maps', 'divider:a1', 'npcs'])
    expect(layout.filter(e => !e.startsWith('divider:')).sort()).toEqual([...NAV_KEYS].sort())
    expect(normalizeNavLayout(Array.from({ length: 30 }, (_, i) => `divider:d${i}`)).filter(e => e.startsWith('divider:'))).toHaveLength(20)
  })

  it('default order first, then the saved order', async () => {
    expect(await call('index.get.ts')).toEqual([...NAV_KEYS])

    const saved = await call<string[]>('index.put.ts', { layout: ['music', 'divider:x', 'npcs'] })
    expect(saved.slice(0, 3)).toEqual(['music', 'divider:x', 'npcs'])
    expect(await call('index.get.ts')).toEqual(saved)
    // Stored encrypted like every setting
    expect((db.prepare('SELECT value FROM settings WHERE key = ?').get('navigation_layout') as { value: string }).value).not.toContain('music')

    // "Default" in the editor is just saving the default order
    expect(await call('index.put.ts', { layout: [] })).toEqual([...NAV_KEYS])
    expect(await call('index.get.ts')).toEqual([...NAV_KEYS])
  })

  it('rejects a body without a layout', async () => {
    await expect(call('index.put.ts', { layout: 'npcs' })).rejects.toMatchObject({ statusCode: 400 })
  })
})
