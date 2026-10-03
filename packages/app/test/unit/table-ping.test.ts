import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { createGameKeys, importVerifyKey, loadGameKeys, open, type Envelope, type StoredGameKeys } from '@dm-hero/seal'
import { getTestDb } from '../utils/test-db'
import { isPingContent } from '../../types/fog'

// DM pings: only on the shown map, encrypted with the game key and signed by the DM
let db: Database.Database
const sent: Envelope[] = []

vi.mock('../../server/utils/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../server/utils/db')>()
  return { ...original, getDb: () => db }
})
vi.mock('../../server/utils/relay', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../server/utils/relay')>()
  return {
    ...original,
    postRelayDmPing: async (_a: unknown, envelope: Envelope) => {
      sent.push(envelope)
    },
  }
})

let request: { params?: Record<string, string>, body?: unknown } = {}
beforeAll(() => {
  const g = globalThis as Record<string, unknown>
  g.defineEventHandler = (handler: unknown) => handler
  g.getRouterParam = (_: unknown, name: string) => request.params?.[name]
  g.readBody = async () => request.body
  g.createError = (o: { statusCode: number, message: string }) => Object.assign(new Error(o.message), { statusCode: o.statusCode })
})

async function ping(body: unknown) {
  request = { params: { id: String(tableId) }, body }
  const handler = (await import('../../server/api/game-table/[id]/ping.post')).default as (e: unknown) => Promise<unknown>
  return handler({})
}

let tableId: number
let mapId: number
let keys: StoredGameKeys

beforeEach(async () => {
  sent.length = 0
  db = getTestDb()
  const campaignId = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Ping').lastInsertRowid)
  mapId = Number(db.prepare('INSERT INTO campaign_maps (campaign_id, name, image_url) VALUES (?, ?, ?)').run(campaignId, 'Welt', 'w.png').lastInsertRowid)
  keys = await createGameKeys()
  tableId = Number(db.prepare('INSERT INTO game_tables (campaign_id, code, relay_game_id, relay_dm_token, e2e_keys, shown_map_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(campaignId, 'PINGPG', 'relay-game', 'token', JSON.stringify(keys), mapId).lastInsertRowid)
})

describe('pings', () => {
  it('a DM ping is encrypted and carries a valid DM signature', async () => {
    await ping({ mapId, x: 12.5, y: 80 })
    const loaded = await loadGameKeys(keys)
    const content = await open(loaded.gameKey, sent[0]!, await importVerifyKey(keys.signing.publicKey))
    expect(content).toEqual({ mapId, x: 12.5, y: 80 })
    expect(sent[0]!.header).toMatchObject({ from: 'dm', to: 'all', gameId: 'relay-game' })
  })

  it('a DM note travels with the ping, trimmed and at most 80 characters', async () => {
    await ping({ mapId, x: 50, y: 50, text: '  Hier liegt die Falle!  ' })
    const content = await open((await loadGameKeys(keys)).gameKey, sent[0]!, await importVerifyKey(keys.signing.publicKey))
    expect(content).toEqual({ mapId, x: 50, y: 50, text: 'Hier liegt die Falle!' })
    await expect(ping({ mapId, x: 50, y: 50, text: 'x'.repeat(81) })).rejects.toMatchObject({ statusCode: 400 })
    expect(sent).toHaveLength(1)
  })

  it('only on the map the players see, only inside the map', async () => {
    await expect(ping({ mapId: mapId + 1, x: 10, y: 10 })).rejects.toMatchObject({ statusCode: 409 })
    await expect(ping({ mapId, x: 120, y: 10 })).rejects.toMatchObject({ statusCode: 400 })
    expect(sent).toHaveLength(0)
    expect(isPingContent({ mapId: 1, x: Number.NaN, y: 1 })).toBe(false)
  })
})
