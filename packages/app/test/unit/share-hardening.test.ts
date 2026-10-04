import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type Database from 'better-sqlite3'
import sharp from 'sharp'
import { createGameKeys, loadGameKeys, open, type Envelope, type StoredGameKeys } from '@dm-hero/seal'
import { getTestDb } from '../utils/test-db'
import type { ShareContent } from '../../types/share'

// Fixes from the PR #368 review: sync lock, retries, isolation, aliases, key rotation
const uploadDir = mkdtempSync(join(tmpdir(), 'dm-hero-hardening-'))
const files = new Map<string, Uint8Array>()
const puts: Array<{ key: string, envelope: Envelope }> = []
const delivered: Array<{ playerId: number, publicKey: string }> = []
let failUploads = false

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
    putRelayShare: async (_a: unknown, key: string, envelope: Envelope) => {
      puts.push({ key, envelope })
    },
    deleteRelayShare: async () => {},
    // Campaign name / map for players - not part of these tests
    putRelayState: async () => {},
    putRelayFile: async (_a: unknown, fileId: string, data: Uint8Array) => {
      // Slow upload: makes overlapping syncs likely if they weren't serialized
      await new Promise(r => setTimeout(r, 20))
      if (failUploads) throw new Error('relay hiccup')
      files.set(fileId, data)
    },
    deleteRelayFile: async (_a: unknown, fileId: string) => {
      files.delete(fileId)
    },
  }
})

const { syncTableShares } = await import('../../server/utils/share/sync')
const { SHARE_KINDS } = await import('../../server/utils/share/registry')
const { npcShareKind } = await import('../../server/utils/share/kinds/npc')

let db: Database.Database
let tableId: number
let campaignId: number
const typeId = (name: string) => (db.prepare('SELECT id FROM entity_types WHERE name = ?').get(name) as { id: number }).id

function addEntity(type: string, name: string, extra: { description?: string, image?: string } = {}) {
  return Number(db.prepare('INSERT INTO entities (type_id, name, description, image_url, campaign_id) VALUES (?, ?, ?, ?, ?)')
    .run(typeId(type), name, extra.description ?? null, extra.image ?? null, campaignId).lastInsertRowid)
}

function share(entityId: number, fields: string[], displayName: string | null = null, type = 'npc') {
  return Number(db.prepare('INSERT INTO game_table_shares (game_table_id, share_key, entity_type, entity_id, fields, display_name) VALUES (?, ?, ?, ?, ?, ?)')
    .run(tableId, `share-${entityId}`, type, entityId, JSON.stringify(fields), displayName).lastInsertRowid)
}

const storedKeys = () => JSON.parse((db.prepare('SELECT e2e_keys FROM game_tables WHERE id = ?').get(tableId) as { e2e_keys: string }).e2e_keys) as StoredGameKeys

beforeEach(async () => {
  files.clear()
  puts.length = 0
  delivered.length = 0
  failUploads = false
  SHARE_KINDS.npc = npcShareKind
  db = getTestDb()
  ;(globalThis as Record<string, unknown>).createError = (o: { message: string }) => new Error(o.message)
  writeFileSync(join(uploadDir, 'a.png'), await sharp({ create: { width: 400, height: 300, channels: 3, background: '#335577' } }).png().toBuffer())

  campaignId = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Hardening').lastInsertRowid)
  tableId = Number(db.prepare('INSERT INTO game_tables (campaign_id, code, relay_game_id, relay_dm_token, e2e_keys) VALUES (?, ?, ?, ?, ?)')
    .run(campaignId, 'HARDEN', 'relay-game', 'token', JSON.stringify(await createGameKeys())).lastInsertRowid)
})

describe('share sync hardening', () => {
  it('overlapping syncs never delete each other\'s image files (review #1)', async () => {
    share(addEntity('NPC', 'Gandalf', { image: 'a.png' }), ['image'])
    await Promise.all([syncTableShares(db, tableId), syncTableShares(db, tableId), syncTableShares(db, tableId)])

    expect(files.size).toBe(2)
    const field = (await open<ShareContent>((await loadGameKeys(storedKeys())).gameKey, puts.at(-1)!.envelope)).fields[0]!
    if (field.format !== 'image') throw new Error('image expected')
    expect(files.has(field.image.thumb.fileId) && files.has(field.image.full.fileId)).toBe(true)
  })

  it('a failed image upload is retried instead of being remembered as done (review #2)', async () => {
    const shareId = share(addEntity('NPC', 'Gandalf', { image: 'a.png' }), ['image'])
    failUploads = true
    await syncTableShares(db, tableId)
    expect(db.prepare('SELECT content_hash FROM game_table_shares WHERE id = ?').get(shareId)).toEqual({ content_hash: null })

    failUploads = false
    await syncTableShares(db, tableId)
    expect(files.size).toBe(2)
  })

  it('one broken share does not block the others (review #3)', async () => {
    const broken = share(addEntity('NPC', 'Kaputt'), ['description'])
    share(addEntity('NPC', 'Heil', { description: 'Läuft' }), ['description'])
    const brokenEntity = (db.prepare('SELECT entity_id FROM game_table_shares WHERE id = ?').get(broken) as { entity_id: number }).entity_id
    SHARE_KINDS.npc = {
      ...npcShareKind,
      build: (d, id, f, c) => {
        if (id === brokenEntity) throw new Error('boom')
        return npcShareKind.build(d, id, f, c)
      },
    }

    const errors = await syncTableShares(db, tableId)
    expect([...errors.keys()]).toEqual([broken])
    expect(puts).toHaveLength(1)
  })

  it('names of entities shared under an alias stay hidden in other shares (review #5)', async () => {
    const stranger = addEntity('NPC', 'Gandalf')
    share(stranger, ['description'], 'Der mysteriöse Mann')
    const lore = addEntity('Lore', 'Gerücht', { description: `Man sah {{npc:${stranger}}} am Tor.` })
    share(lore, ['description'], null, 'lore')

    await syncTableShares(db, tableId)
    const keys = await loadGameKeys(storedKeys())
    const loreContent = await open<ShareContent>(keys.gameKey, puts.find(p => p.key === `share-${lore}`)!.envelope)
    expect(JSON.stringify(loreContent)).toContain('Der mysteriöse Mann')
    expect(JSON.stringify(loreContent)).not.toContain('Gandalf')
  })
})

describe('key rotation (review #9)', () => {
  it('a new game key goes out and every share is re-sealed with it', async () => {
    const { rotateTableKey } = await import('../../server/utils/relay-keys')
    share(addEntity('NPC', 'Gandalf', { description: 'Ein Zauberer' }), ['description'])
    await syncTableShares(db, tableId)
    const oldKeys = await loadGameKeys(storedKeys())
    puts.length = 0

    await rotateTableKey(tableId)
    const newKeys = await loadGameKeys(storedKeys())
    expect(newKeys.epoch).toBe(2)

    const resealed = puts.at(-1)!.envelope
    expect(resealed.header.epoch).toBe(2)
    expect((await open<ShareContent>(newKeys.gameKey, resealed)).title).toBe('Gandalf')
    // A removed player's old key can't read anything new
    await expect(open(oldKeys.gameKey, resealed)).rejects.toThrow()
  })
})
