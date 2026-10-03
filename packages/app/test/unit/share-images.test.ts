import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type Database from 'better-sqlite3'
import sharp from 'sharp'
import { createGameKeys, decryptFile, loadGameKeys, open, type Envelope } from '@dm-hero/seal'
import { getTestDb } from '../utils/test-db'
import type { ShareContent } from '../../types/share'

// Share images: resized, encrypted per file, uploaded once, replaced and removed cleanly
const uploadDir = mkdtempSync(join(tmpdir(), 'dm-hero-share-img-'))
const files = new Map<string, Uint8Array>()
const shares: Envelope[] = []

vi.mock('../../server/utils/paths', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../server/utils/paths')>()
  return { ...original, getUploadPath: () => uploadDir }
})
vi.mock('../../server/utils/relay', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../server/utils/relay')>()
  return {
    ...original,
    putRelayShare: async (_a: unknown, _k: string, envelope: Envelope) => {
      shares.push(envelope)
    },
    deleteRelayShare: async () => {},
    putRelayFile: async (_a: unknown, fileId: string, data: Uint8Array) => {
      files.set(fileId, data)
    },
    deleteRelayFile: async (_a: unknown, fileId: string) => {
      files.delete(fileId)
    },
  }
})

const { syncTableShares } = await import('../../server/utils/share/sync')

let db: Database.Database
let tableId: number
let npcId: number
let keys: Awaited<ReturnType<typeof createGameKeys>>

async function writeImage(name: string, color: string) {
  writeFileSync(join(uploadDir, name), await sharp({ create: { width: 2000, height: 1500, channels: 3, background: color } }).png().toBuffer())
}

const lastContent = async () => open<ShareContent>((await loadGameKeys(keys)).gameKey, shares.at(-1)!)

beforeEach(async () => {
  files.clear()
  shares.length = 0
  db = getTestDb()
  ;(globalThis as Record<string, unknown>).createError = (o: { message: string }) => new Error(o.message)
  await writeImage('a.png', '#aa3322')
  await writeImage('b.png', '#2233aa')

  const campaignId = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Img').lastInsertRowid)
  const typeId = (db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as { id: number }).id
  npcId = Number(db.prepare('INSERT INTO entities (type_id, name, image_url, campaign_id) VALUES (?, ?, ?, ?)').run(typeId, 'Gandalf', 'a.png', campaignId).lastInsertRowid)
  keys = await createGameKeys()
  tableId = Number(db.prepare('INSERT INTO game_tables (campaign_id, code, relay_game_id, relay_dm_token, e2e_keys) VALUES (?, ?, ?, ?, ?)')
    .run(campaignId, 'IMGIMG', 'relay-game', 'token', JSON.stringify(keys)).lastInsertRowid)
  db.prepare('INSERT INTO game_table_shares (game_table_id, share_key, entity_type, entity_id, fields) VALUES (?, ?, ?, ?, ?)')
    .run(tableId, 'share-img', 'npc', npcId, JSON.stringify(['image']))
})

describe('share images', () => {
  it('uploads a small preview and a view size, both encrypted and readable with the key', async () => {
    await syncTableShares(db, tableId)
    expect(files.size).toBe(2)

    const field = (await lastContent()).fields.find(f => f.format === 'image')!
    if (field.format !== 'image') throw new Error('image field expected')
    const thumb = await sharp(Buffer.from(await decryptFile(files.get(field.image.thumb.fileId)! as Uint8Array<ArrayBuffer>, field.image.thumb))).metadata()
    const full = await sharp(Buffer.from(await decryptFile(files.get(field.image.full.fileId)! as Uint8Array<ArrayBuffer>, field.image.full))).metadata()
    expect([thumb.format, thumb.width]).toEqual(['webp', 160])
    expect([full.format, full.width]).toEqual(['webp', 1200])
  })

  it('does not upload again for an unchanged image, replaces files for a new one', async () => {
    await syncTableShares(db, tableId)
    const first = [...files.keys()]
    await syncTableShares(db, tableId)
    expect([...files.keys()]).toEqual(first)

    db.prepare('UPDATE entities SET image_url = ? WHERE id = ?').run('b.png', npcId)
    await syncTableShares(db, tableId)
    expect(files.size).toBe(2)
    expect([...files.keys()].some(id => first.includes(id))).toBe(false)
  })

  it('removes the files when the image is no longer shared', async () => {
    await syncTableShares(db, tableId)
    db.prepare('UPDATE game_table_shares SET fields = ?, content_hash = NULL').run(JSON.stringify(['description']))
    await syncTableShares(db, tableId)
    expect(files.size).toBe(0)
    expect(db.prepare('SELECT COUNT(*) AS n FROM game_table_share_files').get()).toEqual({ n: 0 })
  })
})
