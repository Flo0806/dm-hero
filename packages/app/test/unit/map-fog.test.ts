import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { getTestDb } from '../utils/test-db'
import { isMapFog, type MapFog } from '../../types/fog'

// Fog of war per map + the one map shown to the players - REAL handlers, in-memory DB
let db: Database.Database

vi.mock('../../server/utils/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../server/utils/db')>()
  return { ...original, getDb: () => db }
})

const STUBBED_KEYS = ['defineEventHandler', 'getRouterParam', 'readBody', 'createError'] as const
const originalGlobals = new Map<string, { had: boolean, value: unknown }>()
let request: { params?: Record<string, string>, body?: unknown } = {}

class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
  }
}

async function call<T>(path: string, req: typeof request = {}): Promise<T> {
  request = req
  const handler = (await import(`../../server/api/${path}`)).default as (event: unknown) => unknown
  return await handler({}) as T
}

beforeAll(() => {
  const g = globalThis as Record<string, unknown>
  for (const key of STUBBED_KEYS) originalGlobals.set(key, { had: Object.hasOwn(g, key), value: g[key] })
  g.defineEventHandler = (handler: unknown) => handler
  g.getRouterParam = (_: unknown, name: string) => request.params?.[name]
  g.readBody = async () => request.body
  g.createError = (opts: { statusCode: number, message: string }) => new HttpError(opts.statusCode, opts.message)
})

afterAll(() => {
  const g = globalThis as Record<string, unknown>
  for (const [key, snapshot] of originalGlobals) {
    if (snapshot.had) g[key] = snapshot.value
    else Reflect.deleteProperty(g, key)
  }
})

let campaignId: number
let mapId: number
let tableId: number

const addCampaign = (name: string) => Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run(name).lastInsertRowid)
const addMap = (campaign: number) => Number(db.prepare('INSERT INTO campaign_maps (campaign_id, name, image_url) VALUES (?, ?, ?)').run(campaign, 'Welt', 'map.png').lastInsertRowid)
const shownMap = () => (db.prepare('SELECT shown_map_id FROM game_tables WHERE id = ?').get(tableId) as { shown_map_id: number | null }).shown_map_id

beforeEach(() => {
  db = getTestDb()
  campaignId = addCampaign('Fog')
  mapId = addMap(campaignId)
  tableId = Number(db.prepare('INSERT INTO game_tables (campaign_id, code, relay_game_id, relay_dm_token) VALUES (?, ?, ?, ?)')
    .run(campaignId, 'FOGFOG', 'relay', 'token').lastInsertRowid)
})

const fog: MapFog = {
  base: 'covered',
  strokes: [{ mode: 'reveal', radius: 4, points: [[10, 10], [20, 15]] }, { mode: 'cover', radius: 1.5, points: [[12, 12]] }],
}

describe('map fog', () => {
  it('starts fully covered and keeps what the DM painted', async () => {
    expect(await call('maps/[id]/fog.get.ts', { params: { id: String(mapId) } })).toEqual({ base: 'covered', strokes: [] })
    await call('maps/[id]/fog.put.ts', { params: { id: String(mapId) }, body: fog })
    expect(await call('maps/[id]/fog.get.ts', { params: { id: String(mapId) } })).toEqual(fog)

    // Overwrite, not append
    await call('maps/[id]/fog.put.ts', { params: { id: String(mapId) }, body: { base: 'clear', strokes: [] } })
    expect(await call('maps/[id]/fog.get.ts', { params: { id: String(mapId) } })).toEqual({ base: 'clear', strokes: [] })
  })

  it('strokes painted past the map edge are saved at the edge', async () => {
    const painted: MapFog = { base: 'covered', strokes: [{ mode: 'reveal', radius: 4, points: [[-5, 20], [100.5, 120]] }] }
    await call('maps/[id]/fog.put.ts', { params: { id: String(mapId) }, body: painted })
    expect(await call('maps/[id]/fog.get.ts', { params: { id: String(mapId) } }))
      .toEqual({ base: 'covered', strokes: [{ mode: 'reveal', radius: 4, points: [[0, 20], [100, 100]] }] })
  })

  it('rejects broken fog', async () => {
    for (const body of [null, { base: 'nope', strokes: [] }, { base: 'covered', strokes: [{ mode: 'reveal', radius: 4, points: [] }] }, { base: 'covered', strokes: [{ mode: 'reveal', radius: 4, points: [['x', 1]] }] }]) {
      expect(isMapFog(body)).toBe(false)
      await expect(call('maps/[id]/fog.put.ts', { params: { id: String(mapId) }, body })).rejects.toMatchObject({ statusCode: 400 })
    }
  })
})

describe('shown map', () => {
  it('shows exactly one map, switching replaces it, null hides it', async () => {
    const second = addMap(campaignId)
    await call('game-table/[id]/shown-map.put.ts', { params: { id: String(tableId) }, body: { mapId } })
    expect(shownMap()).toBe(mapId)
    await call('game-table/[id]/shown-map.put.ts', { params: { id: String(tableId) }, body: { mapId: second } })
    expect(shownMap()).toBe(second)
    await call('game-table/[id]/shown-map.put.ts', { params: { id: String(tableId) }, body: { mapId: null } })
    expect(shownMap()).toBeNull()
  })

  it('never shows a map of another campaign', async () => {
    const foreign = addMap(addCampaign('Other'))
    await expect(call('game-table/[id]/shown-map.put.ts', { params: { id: String(tableId) }, body: { mapId: foreign } }))
      .rejects.toMatchObject({ statusCode: 400 })
    expect(shownMap()).toBeNull()
  })

  it('deleting the shown map stops showing it', async () => {
    await call('game-table/[id]/shown-map.put.ts', { params: { id: String(tableId) }, body: { mapId } })
    await call('maps/[id]/index.delete.ts', { params: { id: String(mapId) } })
    expect(shownMap()).toBeNull()
  })
})
