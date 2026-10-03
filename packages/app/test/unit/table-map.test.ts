import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type Database from 'better-sqlite3'
import sharp from 'sharp'
import { createGameKeys, decryptFile, loadGameKeys, open, type Envelope, type StoredGameKeys } from '@dm-hero/seal'
import { getTestDb } from '../utils/test-db'
import type { MapFog, TableFogContent, TableMapContent } from '../../types/fog'

// The shown map + fog of war reach the relay encrypted, only when something changed
const uploadDir = mkdtempSync(join(tmpdir(), 'dm-hero-table-map-'))
const files = new Map<string, Uint8Array>()
const calls: string[] = []
let failUploads = false
const state = new Map<string, Envelope>()

vi.mock('../../server/utils/paths', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../server/utils/paths')>()
  return { ...original, getUploadPath: () => uploadDir }
})
vi.mock('../../server/utils/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../server/utils/db')>()
  return { ...original, getDb: () => db }
})
vi.mock('../../server/utils/relay', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../server/utils/relay')>()
  return {
    ...original,
    putRelayShare: async () => {},
    putRelayState: async (_a: unknown, slot: string, envelope: Envelope) => {
      calls.push(`put:${slot}`)
      state.set(slot, envelope)
    },
    deleteRelayState: async (_a: unknown, slot: string) => {
      calls.push(`delete:${slot}`)
      state.delete(slot)
    },
    putRelayFile: async (_a: unknown, fileId: string, data: Uint8Array) => {
      calls.push('file')
      if (failUploads) throw new Error('relay down')
      files.set(fileId, data)
    },
    deleteRelayFile: async (_a: unknown, fileId: string) => {
      files.delete(fileId)
    },
  }
})

const { syncTableMap, syncMapFog } = await import('../../server/utils/share/map')
const { rotateTableKey } = await import('../../server/utils/relay-keys')

let db: Database.Database
let tableId: number
let mapId: number

const gameKey = async () => (await loadGameKeys(JSON.parse((db.prepare('SELECT e2e_keys FROM game_tables WHERE id = ?').get(tableId) as { e2e_keys: string }).e2e_keys) as StoredGameKeys)).gameKey
const show = (id: number | null) => db.prepare('UPDATE game_tables SET shown_map_id = ? WHERE id = ?').run(id, tableId)
const setFog = (fog: MapFog) => db.prepare('INSERT INTO map_fog (map_id, fog) VALUES (?, ?) ON CONFLICT(map_id) DO UPDATE SET fog = excluded.fog').run(mapId, JSON.stringify(fog))

beforeEach(async () => {
  files.clear()
  calls.length = 0
  failUploads = false
  state.clear()
  db = getTestDb()
  ;(globalThis as Record<string, unknown>).createError = (o: { message: string }) => new Error(o.message)
  for (const [name, color] of [['world.png', '#446622'], ['world2.png', '#224466']]) {
    writeFileSync(join(uploadDir, name!), await sharp({ create: { width: 4000, height: 2000, channels: 3, background: color! } }).png().toBuffer())
  }
  const campaignId = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Map').lastInsertRowid)
  mapId = Number(db.prepare('INSERT INTO campaign_maps (campaign_id, name, image_url) VALUES (?, ?, ?)').run(campaignId, 'Welt', 'world.png').lastInsertRowid)
  tableId = Number(db.prepare('INSERT INTO game_tables (campaign_id, code, relay_game_id, relay_dm_token, e2e_keys) VALUES (?, ?, ?, ?, ?)')
    .run(campaignId, 'MAPMAP', 'relay-game', 'token', JSON.stringify(await createGameKeys())).lastInsertRowid)
})

describe('shown map on the relay', () => {
  it('uploads the image once and sends fog before map, both readable with the game key', async () => {
    show(mapId)
    await syncTableMap(db, tableId)
    expect(calls).toEqual(['file', 'put:fog', 'put:map'])

    const map = await open<TableMapContent>(await gameKey(), state.get('map')!)
    expect(map).toMatchObject({ kind: 'map', mapId, name: 'Welt', width: 3072, height: 1536 })
    const image = await sharp(Buffer.from(await decryptFile(files.get(map.image.fileId)! as Uint8Array<ArrayBuffer>, map.image))).metadata()
    expect([image.format, image.width]).toEqual(['webp', 3072])
    // No fog painted yet: everything covered
    expect(await open<TableFogContent>(await gameKey(), state.get('fog')!)).toEqual({ kind: 'fog', mapId, fog: { base: 'covered', strokes: [] } })

    calls.length = 0
    await syncTableMap(db, tableId)
    expect(calls).toEqual([])
  })

  it('a fog change sends only the fog', async () => {
    show(mapId)
    await syncTableMap(db, tableId)
    calls.length = 0

    const fog: MapFog = { base: 'covered', strokes: [{ mode: 'reveal', radius: 4, points: [[50, 50]] }] }
    setFog(fog)
    await syncMapFog(db, mapId)
    expect(calls).toEqual(['put:fog'])
    expect((await open<TableFogContent>(await gameKey(), state.get('fog')!)).fog).toEqual(fog)
  })

  it('a new image replaces the file, hiding the map withdraws everything', async () => {
    show(mapId)
    await syncTableMap(db, tableId)
    const first = [...files.keys()]

    db.prepare('UPDATE campaign_maps SET image_url = ? WHERE id = ?').run('world2.png', mapId)
    await syncTableMap(db, tableId)
    expect(files.size).toBe(1)
    expect(first.some(id => files.has(id))).toBe(false)

    show(null)
    calls.length = 0
    await syncTableMap(db, tableId)
    expect(calls).toEqual(['delete:map', 'delete:fog'])
    expect(files.size).toBe(0)
  })

  it('key rotation re-seals map and fog with the new key', async () => {
    show(mapId)
    await syncTableMap(db, tableId)
    const oldKey = await gameKey()

    await rotateTableKey(tableId)
    const map = state.get('map')!
    expect(map.header.epoch).toBe(2)
    expect((await open<TableMapContent>(await gameKey(), map)).mapId).toBe(mapId)
    await expect(open(oldKey, map)).rejects.toThrow()
    await expect(open(oldKey, state.get('fog')!)).rejects.toThrow()
  })

  it('a failed upload pauses instead of re-encoding the map every 5 seconds (review #5)', async () => {
    show(mapId)
    failUploads = true
    await expect(syncTableMap(db, tableId)).rejects.toThrow('relay down')
    await syncTableMap(db, tableId)
    await syncTableMap(db, tableId)
    expect(calls.filter(c => c === 'file')).toHaveLength(1)

    // "Show" from the DM tries right away
    failUploads = false
    await syncTableMap(db, tableId, { force: true })
    expect(calls.filter(c => c === 'file')).toHaveLength(2)
    expect(state.has('map')).toBe(true)
  })
})
