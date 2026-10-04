import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type Database from 'better-sqlite3'
import {
  createGameKeys, decryptFile, derivePairKey, exportPublicKey, generateExchangeKeyPair, importExchangePublicKey,
  importVerifyKey, open, type Envelope, type HandoutContent, type StoredGameKeys,
} from '@dm-hero/seal'
import { getTestDb } from '../utils/test-db'

// Handouts: only the chosen players' devices get an envelope they can open
const uploadDir = mkdtempSync(join(tmpdir(), 'dm-hero-handouts-'))
const files = new Map<string, Uint8Array>()
let sent: Record<string, Record<string, Envelope>> | null = null
const withdrawn: string[] = []

vi.mock('../../server/utils/paths', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../server/utils/paths')>()
  return { ...original, getUploadPath: () => uploadDir }
})
vi.mock('../../server/utils/relay', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../server/utils/relay')>()
  return {
    ...original,
    putRelayHandout: async (_a: unknown, _key: string, players: Record<string, Record<string, Envelope>>) => {
      sent = players
    },
    deleteRelayHandout: async (_a: unknown, key: string) => {
      withdrawn.push(key)
    },
    putRelayFile: async (_a: unknown, fileId: string, data: Uint8Array) => {
      files.set(fileId, data)
    },
    deleteRelayFile: async (_a: unknown, fileId: string) => {
      files.delete(fileId)
    },
  }
})

const { syncTableHandouts } = await import('../../server/utils/share/handouts')

let db: Database.Database
let tableId: number
let keys: StoredGameKeys
let entityId: number
const GAME = 'relay-game'

async function addPlayerWithDevice(name: string) {
  const playerId = Number(db.prepare('INSERT INTO game_table_players (game_table_id, name, pin) VALUES (?, ?, ?)').run(tableId, name, String(Math.random()).slice(2, 8)).lastInsertRowid)
  const device = await generateExchangeKeyPair()
  const publicKey = await exportPublicKey(device.publicKey)
  db.prepare('INSERT INTO game_table_devices (game_table_id, player_id, public_key) VALUES (?, ?, ?)').run(tableId, playerId, publicKey)
  return { playerId, publicKey, device }
}

function addDocument(title: string, extra: { content?: string, pdf?: string } = {}) {
  return Number(db.prepare('INSERT INTO entity_documents (entity_id, title, content, date, file_type, file_path) VALUES (?, ?, ?, ?, ?, ?)')
    .run(entityId, title, extra.content ?? '', '2026-10-04', extra.pdf ? 'pdf' : 'markdown', extra.pdf ?? null).lastInsertRowid)
}

const handOut = (documentId: number, recipients: string) => Number(db.prepare('INSERT INTO game_table_handouts (game_table_id, handout_key, document_id, recipients) VALUES (?, ?, ?, ?)')
  .run(tableId, `handout-${documentId}`, documentId, recipients).lastInsertRowid)

/** What a player's device reads from its envelope */
async function openAs(player: Awaited<ReturnType<typeof addPlayerWithDevice>>, envelope: Envelope) {
  const dmExchange = await importExchangePublicKey(keys.exchange.publicKey)
  const pairKey = await derivePairKey(player.device.privateKey, dmExchange, GAME)
  return open<HandoutContent>(pairKey, envelope, await importVerifyKey(keys.signing.publicKey))
}

beforeEach(async () => {
  sent = null
  withdrawn.length = 0
  files.clear()
  db = getTestDb()
  ;(globalThis as Record<string, unknown>).createError = (o: { statusCode: number, message: string }) => Object.assign(new Error(o.message), { statusCode: o.statusCode })
  const campaignId = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Handouts').lastInsertRowid)
  const typeId = (db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Lore') as { id: number }).id
  entityId = Number(db.prepare('INSERT INTO entities (type_id, name, campaign_id) VALUES (?, ?, ?)').run(typeId, 'Briefe', campaignId).lastInsertRowid)
  keys = await createGameKeys()
  tableId = Number(db.prepare('INSERT INTO game_tables (campaign_id, code, relay_game_id, relay_dm_token, e2e_keys) VALUES (?, ?, ?, ?, ?)')
    .run(campaignId, 'HANDOU', GAME, 'token', JSON.stringify(keys)).lastInsertRowid)
})

describe('handouts', () => {
  it('only chosen players get it, sealed per device and signed by the DM', async () => {
    const anna = await addPlayerWithDevice('Anna')
    const ben = await addPlayerWithDevice('Ben')
    handOut(addDocument('Brief an Anna', { content: 'Triff mich um Mitternacht.' }), JSON.stringify([anna.playerId]))

    await syncTableHandouts(db, tableId)
    expect(Object.keys(sent!)).toEqual([String(anna.playerId)])
    const content = await openAs(anna, sent![String(anna.playerId)]![anna.publicKey]!)
    expect(content).toMatchObject({ kind: 'handout', title: 'Brief an Anna', format: 'markdown', text: 'Triff mich um Mitternacht.' })
    // Ben's device can't open Anna's envelope
    await expect(openAs(ben, sent![String(anna.playerId)]![anna.publicKey]!)).rejects.toThrow()
  })

  it('"all" covers players who join later, and is sent again for them', async () => {
    const anna = await addPlayerWithDevice('Anna')
    handOut(addDocument('Aushang', { content: 'Gesucht: Drachen' }), 'all')
    await syncTableHandouts(db, tableId)
    expect(Object.keys(sent!)).toEqual([String(anna.playerId)])

    sent = null
    await syncTableHandouts(db, tableId)
    expect(sent).toBeNull()

    const ben = await addPlayerWithDevice('Ben')
    await syncTableHandouts(db, tableId)
    expect(Object.keys(sent!).sort()).toEqual([String(anna.playerId), String(ben.playerId)].sort())
  })

  it('a PDF is uploaded once, encrypted; over 2 MB is refused', async () => {
    const anna = await addPlayerWithDevice('Anna')
    writeFileSync(join(uploadDir, 'karte.pdf'), Buffer.from('%PDF-1.4 tiny'))
    handOut(addDocument('Karte', { pdf: 'karte.pdf' }), 'all')
    await syncTableHandouts(db, tableId)

    const content = await openAs(anna, sent![String(anna.playerId)]![anna.publicKey]!)
    expect(content.format).toBe('pdf')
    const bytes = await decryptFile(files.get(content.file!.fileId)! as Uint8Array<ArrayBuffer>, content.file!)
    expect(Buffer.from(bytes).toString()).toBe('%PDF-1.4 tiny')

    writeFileSync(join(uploadDir, 'riesig.pdf'), Buffer.alloc(3 * 1024 * 1024))
    const big = handOut(addDocument('Riesig', { pdf: 'riesig.pdf' }), 'all')
    const errors = await syncTableHandouts(db, tableId)
    expect((errors.get(big) as { statusCode?: number }).statusCode).toBe(413)
    expect(files.size).toBe(1)
  })

  it('a deleted document is withdrawn from the players', async () => {
    await addPlayerWithDevice('Anna')
    const doc = addDocument('Geheim', { content: 'x' })
    handOut(doc, 'all')
    await syncTableHandouts(db, tableId)

    db.prepare('DELETE FROM entity_documents WHERE id = ?').run(doc)
    // ON DELETE CASCADE removes the row - a soft-deleted entity is the case the sync handles
    expect(db.prepare('SELECT COUNT(*) AS n FROM game_table_handouts').get()).toEqual({ n: 0 })

    const doc2 = addDocument('Auch geheim', { content: 'y' })
    handOut(doc2, 'all')
    await syncTableHandouts(db, tableId)
    db.prepare('UPDATE entities SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(entityId)
    await syncTableHandouts(db, tableId)
    expect(withdrawn).toEqual([`handout-${doc2}`])
    expect(db.prepare('SELECT COUNT(*) AS n FROM game_table_handouts').get()).toEqual({ n: 0 })
  })
})
