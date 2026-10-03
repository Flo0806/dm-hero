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
})
