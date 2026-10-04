import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { getTestDb } from '../utils/test-db'
import type { GameTable, GameTablePlayer } from '../../types/game-table'

// Runs the REAL game table handlers against an in-memory DB
let db: Database.Database

vi.mock('../../server/utils/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../server/utils/db')>()
  return { ...original, getDb: () => db }
})

// The player relay is a separate server - simulate it
const relayCalls: string[] = []
let relayRefusesHandouts = false
let lastRelayPublicKeys: { signing: string, exchange: string } | null = null
vi.mock('../../server/utils/relay', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../server/utils/relay')>()
  return {
    ...original,
    createRelayGame: async (dmPublicKeys: { signing: string, exchange: string }) => {
      relayCalls.push('create')
      lastRelayPublicKeys = dmPublicKeys
      return { gameId: `relay-${relayCalls.length}`, code: `K7RX${String(relayCalls.length).padStart(2, '0')}`, dmToken: 'secret' }
    },
    deleteRelayGame: async () => {
      relayCalls.push('delete')
    },
    endGameTable: async (database: Database.Database, tableId: number) => {
      relayCalls.push('delete')
      return database.prepare('DELETE FROM game_tables WHERE id = ?').run(tableId).changes > 0
    },
    syncRelayPlayers: async () => {
      relayCalls.push('sync')
    },
    putRelayHandout: async () => {
      if (relayRefusesHandouts) throw Object.assign(new Error('Too large'), { statusCode: 413 })
    },
    // Campaign name / map for players - not part of these tests
    putRelayState: async () => {},
  }
})

const STUBBED_KEYS = ['defineEventHandler', 'getQuery', 'getRouterParam', 'readBody', 'createError'] as const
const originalGlobals = new Map<string, { had: boolean, value: unknown }>()
let request: { query?: Record<string, string>, params?: Record<string, string>, body?: unknown } = {}

type Handler = (event: unknown) => unknown
async function call<T>(path: string, req: typeof request = {}): Promise<T> {
  request = req
  const handler = (await import(`../../server/api/game-table/${path}`)).default as Handler
  return await handler({}) as T
}

class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
  }
}

let campaignId: number

beforeAll(() => {
  const g = globalThis as Record<string, unknown>
  for (const key of STUBBED_KEYS) originalGlobals.set(key, { had: Object.hasOwn(g, key), value: g[key] })
  g.defineEventHandler = (handler: unknown) => handler
  g.getQuery = () => request.query ?? {}
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

beforeEach(() => {
  relayCalls.length = 0
  relayRefusesHandouts = false
  db = getTestDb()
  campaignId = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Game Table').lastInsertRowid)
})

async function startGame() {
  return call<GameTable>('index.post.ts', { body: { campaignId } })
}

describe('game table API', () => {
  it('starts a game with the code from the relay and no players', async () => {
    const table = await startGame()
    expect(relayCalls).toEqual(['create'])
    expect(table.code).toBe('K7RX01')
    expect(table.players).toEqual([])
    // The DM token stays on the server - never in API responses
    expect(JSON.stringify(table)).not.toContain('secret')

    // E2E keys: stored locally, only the public halves went to the relay
    const stored = JSON.parse((db.prepare('SELECT e2e_keys FROM game_tables WHERE id = ?').get(table.id) as { e2e_keys: string }).e2e_keys)
    expect(lastRelayPublicKeys).toEqual({ signing: stored.signing.publicKey, exchange: stored.exchange.publicKey })
    expect(JSON.stringify(lastRelayPublicKeys)).not.toContain(stored.signing.privateKey.d)
    expect(JSON.stringify(table)).not.toContain(stored.gameKey)
    expect(await call<GameTable | null>('index.get.ts', { query: { campaignId: String(campaignId) } })).toMatchObject({ id: table.id })
  })

  it('a new game replaces the old one (ended on the relay too)', async () => {
    const first = await startGame()
    await call('[id]/players.post.ts', { params: { id: String(first.id) }, body: { name: 'Anna' } })
    const second = await startGame()

    expect(second.id).not.toBe(first.id)
    expect(second.players).toEqual([])
    expect(relayCalls).toEqual(['create', 'sync', 'create', 'delete'])
    expect(db.prepare('SELECT COUNT(*) AS n FROM game_tables').get()).toEqual({ n: 1 })
  })

  it('adds players with unique 6-digit PINs and rolls new ones', async () => {
    const table = await startGame()
    const anna = await call<GameTablePlayer>('[id]/players.post.ts', { params: { id: String(table.id) }, body: { name: '  Anna ' } })
    const bernd = await call<GameTablePlayer>('[id]/players.post.ts', { params: { id: String(table.id) }, body: { name: 'Bernd' } })
    expect(anna.name).toBe('Anna')
    expect(anna.pin).toMatch(/^\d{6}$/)
    expect(anna.pin).not.toBe(bernd.pin)

    const rolled = await call<GameTablePlayer>('players/[id]/pin.post.ts', { params: { id: String(anna.id) } })
    expect(rolled.pin).toMatch(/^\d{6}$/)
    // Every player change is pushed to the relay
    expect(relayCalls).toEqual(['create', 'sync', 'sync', 'sync'])
  })

  it('links only Player entities of the same campaign', async () => {
    const table = await startGame()
    const typeId = (name: string) => (db.prepare('SELECT id FROM entity_types WHERE name = ?').get(name) as { id: number }).id
    const playerEntity = Number(db.prepare('INSERT INTO entities (type_id, name, campaign_id) VALUES (?, ?, ?)').run(typeId('Player'), 'Anna Entity', campaignId).lastInsertRowid)
    const npcEntity = Number(db.prepare('INSERT INTO entities (type_id, name, campaign_id) VALUES (?, ?, ?)').run(typeId('NPC'), 'Some NPC', campaignId).lastInsertRowid)

    const linked = await call<GameTablePlayer>('[id]/players.post.ts', { params: { id: String(table.id) }, body: { name: 'Anna', playerEntityId: playerEntity } })
    expect(linked.player_entity_name).toBe('Anna Entity')

    await expect(call('[id]/players.post.ts', { params: { id: String(table.id) }, body: { name: 'X', playerEntityId: npcEntity } }))
      .rejects.toMatchObject({ statusCode: 400 })
  })

  it('renames and removes players', async () => {
    const table = await startGame()
    const anna = await call<GameTablePlayer>('[id]/players.post.ts', { params: { id: String(table.id) }, body: { name: 'Anna' } })
    const renamed = await call<GameTablePlayer>('players/[id]/index.patch.ts', { params: { id: String(anna.id) }, body: { name: 'Annabelle' } })
    expect(renamed.name).toBe('Annabelle')

    await call('players/[id]/index.delete.ts', { params: { id: String(anna.id) } })
    expect((await call<GameTable>('index.get.ts', { query: { campaignId: String(campaignId) } })).players).toEqual([])
  })

  it('closing the game removes everything', async () => {
    const table = await startGame()
    await call('[id]/players.post.ts', { params: { id: String(table.id) }, body: { name: 'Anna' } })
    await call('[id]/index.delete.ts', { params: { id: String(table.id) } })
    expect(relayCalls).toContain('delete')
    expect(await call('index.get.ts', { query: { campaignId: String(campaignId) } })).toBeNull()
    expect(db.prepare('SELECT COUNT(*) AS n FROM game_table_players').get()).toEqual({ n: 0 })
  })

  it('reconnect after expiry keeps players and shares, gets a new code and keys', async () => {
    const table = await startGame()
    const player = await call<GameTablePlayer>('[id]/players.post.ts', { params: { id: String(table.id) }, body: { name: 'Anna' } })
    const typeId = (db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as { id: number }).id
    const npc = Number(db.prepare('INSERT INTO entities (type_id, name, campaign_id) VALUES (?, ?, ?)').run(typeId, 'Gandalf', campaignId).lastInsertRowid)
    db.prepare('INSERT INTO game_table_shares (game_table_id, share_key, entity_type, entity_id, fields, content_hash) VALUES (?, ?, ?, ?, ?, ?)')
      .run(table.id, 'share-1', 'npc', npc, '[]', 'sent')
    db.prepare('INSERT INTO game_table_devices (game_table_id, player_id, public_key) VALUES (?, ?, ?)').run(table.id, player.id, 'device-key')
    const oldKeys = (db.prepare('SELECT e2e_keys FROM game_tables WHERE id = ?').get(table.id) as { e2e_keys: string }).e2e_keys

    const reconnected = await call<GameTable>('[id]/reconnect.post.ts', { params: { id: String(table.id) } })

    expect(reconnected.id).toBe(table.id)
    expect(reconnected.code).not.toBe(table.code)
    expect(reconnected.players).toMatchObject([{ id: player.id, name: 'Anna', pin: player.pin }])
    expect(db.prepare('SELECT content_hash FROM game_table_shares').get()).toEqual({ content_hash: null })
    expect(db.prepare('SELECT COUNT(*) AS n FROM game_table_devices').get()).toEqual({ n: 0 })
    expect((db.prepare('SELECT e2e_keys FROM game_tables WHERE id = ?').get(table.id) as { e2e_keys: string }).e2e_keys).not.toBe(oldKeys)
  })

  it('handing a document to chosen players stores exactly them', async () => {
    const table = await startGame()
    const anna = await call<GameTablePlayer>('[id]/players.post.ts', { params: { id: String(table.id) }, body: { name: 'Anna' } })
    await call<GameTablePlayer>('[id]/players.post.ts', { params: { id: String(table.id) }, body: { name: 'Ben' } })
    const typeId = (db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Lore') as { id: number }).id
    const entity = Number(db.prepare('INSERT INTO entities (type_id, name, campaign_id) VALUES (?, ?, ?)').run(typeId, 'Briefe', campaignId).lastInsertRowid)
    const doc = Number(db.prepare('INSERT INTO entity_documents (entity_id, title, content, date) VALUES (?, ?, ?, ?)').run(entity, 'Brief', 'Hallo', '2026-10-04').lastInsertRowid)

    await call('[id]/handouts.put.ts', { params: { id: String(table.id) }, body: { documentId: doc, recipients: [anna.id] } })
    expect(await call('[id]/handouts.get.ts', { params: { id: String(table.id) } })).toMatchObject([{ document_id: doc, recipients: [anna.id] }])

    await call('[id]/handouts.put.ts', { params: { id: String(table.id) }, body: { documentId: doc, recipients: 'all' } })
    expect(await call('[id]/handouts.get.ts', { params: { id: String(table.id) } })).toMatchObject([{ recipients: 'all' }])
  })

  it('a refused change keeps the previous recipients', async () => {
    const table = await startGame()
    const anna = await call<GameTablePlayer>('[id]/players.post.ts', { params: { id: String(table.id) }, body: { name: 'Anna' } })
    const typeId = (db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Lore') as { id: number }).id
    const entity = Number(db.prepare('INSERT INTO entities (type_id, name, campaign_id) VALUES (?, ?, ?)').run(typeId, 'Briefe', campaignId).lastInsertRowid)
    const doc = Number(db.prepare('INSERT INTO entity_documents (entity_id, title, content, date) VALUES (?, ?, ?, ?)').run(entity, 'Brief', 'Hallo', '2026-10-04').lastInsertRowid)
    await call('[id]/handouts.put.ts', { params: { id: String(table.id) }, body: { documentId: doc, recipients: [anna.id] } })

    relayRefusesHandouts = true
    await expect(call('[id]/handouts.put.ts', { params: { id: String(table.id) }, body: { documentId: doc, recipients: 'all' } }))
      .rejects.toMatchObject({ statusCode: 413 })
    expect(await call('[id]/handouts.get.ts', { params: { id: String(table.id) } })).toMatchObject([{ recipients: [anna.id] }])
  })
})
