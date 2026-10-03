import { describe, it, expect, beforeEach, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { createGameKeys, importVerifyKey, loadGameKeys, open, type Envelope } from '@dm-hero/seal'
import { getTestDb } from '../utils/test-db'
import type { ShareContent } from '../../types/share'

// Central share sync: sends changed content (sealed), skips unchanged, withdraws deleted entities
const sent: Array<{ op: 'put' | 'delete', key: string, envelope?: Envelope }> = []

vi.mock('../../server/utils/relay', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../server/utils/relay')>()
  return {
    ...original,
    putRelayShare: async (_auth: unknown, key: string, envelope: Envelope) => {
      sent.push({ op: 'put', key, envelope })
    },
    deleteRelayShare: async (_auth: unknown, key: string) => {
      sent.push({ op: 'delete', key })
    },
  }
})

const { SHARE_KINDS } = await import('../../server/utils/share/registry')
const { syncTableShares } = await import('../../server/utils/share/sync')

let db: Database.Database
let tableId: number
let entityId: number
let keys: Awaited<ReturnType<typeof createGameKeys>>

beforeEach(async () => {
  sent.length = 0
  db = getTestDb()
  ;(globalThis as Record<string, unknown>).createError = (o: { message: string }) => new Error(o.message)

  // Test kind: shares an entity's name + description
  SHARE_KINDS.npc = {
    typeLabel: 'npcs.title',
    fields: ['description'],
    build: (database, id) => {
      const e = database.prepare('SELECT name, description FROM entities WHERE id = ? AND deleted_at IS NULL').get(id) as { name: string, description: string } | undefined
      return e ? { title: e.name, fields: [{ key: 'description', format: 'markdown' as const, label: 'Description', value: e.description }] } : null
    },
  }

  const campaignId = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Share').lastInsertRowid)
  const typeId = (db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as { id: number }).id
  entityId = Number(db.prepare('INSERT INTO entities (type_id, name, description, campaign_id) VALUES (?, ?, ?, ?)').run(typeId, 'Gandalf', 'Ein Zauberer', campaignId).lastInsertRowid)

  keys = await createGameKeys()
  tableId = Number(db.prepare('INSERT INTO game_tables (campaign_id, code, relay_game_id, relay_dm_token, e2e_keys) VALUES (?, ?, ?, ?, ?)')
    .run(campaignId, 'ABCDEF', 'relay-game', 'token', JSON.stringify(keys)).lastInsertRowid)
  db.prepare('INSERT INTO game_table_shares (game_table_id, share_key, entity_type, entity_id, fields) VALUES (?, ?, ?, ?, ?)')
    .run(tableId, 'share-1', 'npc', entityId, JSON.stringify(['description']))
})

describe('share sync', () => {
  it('sends a sealed, DM-signed share players can open', async () => {
    await syncTableShares(db, tableId)
    expect(sent.map(s => s.op)).toEqual(['put'])

    const loaded = await loadGameKeys(keys)
    const content = await open<ShareContent>(loaded.gameKey, sent[0]!.envelope!, await importVerifyKey(keys.signing.publicKey))
    expect(content).toMatchObject({ shareId: 'share-1', type: 'npc', title: 'Gandalf', fields: [{ key: 'description', value: 'Ein Zauberer' }] })
    expect(content.typeLabel).toMatchObject({ de: 'NPCs', en: 'NPCs' })
  })

  it('does not resend unchanged content, but resends after an edit', async () => {
    await syncTableShares(db, tableId)
    await syncTableShares(db, tableId)
    expect(sent).toHaveLength(1)

    db.prepare('UPDATE entities SET description = ? WHERE id = ?').run('Ein grauer Zauberer', entityId)
    await syncTableShares(db, tableId)
    expect(sent).toHaveLength(2)
  })

  it('withdraws the share when the entity is deleted', async () => {
    await syncTableShares(db, tableId)
    db.prepare('UPDATE entities SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(entityId)
    await syncTableShares(db, tableId)

    expect(sent.map(s => s.op)).toEqual(['put', 'delete'])
    expect(db.prepare('SELECT COUNT(*) AS n FROM game_table_shares').get()).toEqual({ n: 0 })
  })

  it('shows the alias instead of the real name - and sends again on the reveal', async () => {
    db.prepare('UPDATE game_table_shares SET display_name = ?').run('Der mysteriöse Mann')
    await syncTableShares(db, tableId)
    const loaded = await loadGameKeys(keys)
    const hidden = await open<ShareContent>(loaded.gameKey, sent[0]!.envelope!)
    expect(hidden.title).toBe('Der mysteriöse Mann')
    expect(JSON.stringify(hidden)).not.toContain('Gandalf')

    // Reveal: alias removed -> real name goes out
    db.prepare('UPDATE game_table_shares SET display_name = NULL').run()
    await syncTableShares(db, tableId)
    expect((await open<ShareContent>(loaded.gameKey, sent[1]!.envelope!)).title).toBe('Gandalf')
  })
})
