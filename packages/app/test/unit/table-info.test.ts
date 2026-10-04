import { describe, it, expect, beforeEach, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { createGameKeys, importVerifyKey, isTableInfoContent, loadGameKeys, open, type Envelope, type StoredGameKeys } from '@dm-hero/seal'
import { getTestDb } from '../utils/test-db'

// Campaign name for joined players: encrypted + signed, only sent when it changes
const puts: Array<{ slot: string, envelope: Envelope }> = []

vi.mock('../../server/utils/relay', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../server/utils/relay')>()
  return {
    ...original,
    putRelayState: async (_a: unknown, slot: string, envelope: Envelope) => {
      puts.push({ slot, envelope })
    },
  }
})

const { syncTableInfo, forgetTableInfo } = await import('../../server/utils/share/info')

let db: Database.Database
let tableId: number
let campaignId: number
let keys: StoredGameKeys

beforeEach(async () => {
  puts.length = 0
  db = getTestDb()
  campaignId = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Der Fluch von Strahd').lastInsertRowid)
  keys = await createGameKeys()
  tableId = Number(db.prepare('INSERT INTO game_tables (campaign_id, code, relay_game_id, relay_dm_token, e2e_keys) VALUES (?, ?, ?, ?, ?)')
    .run(campaignId, 'INFOIN', `relay-${Date.now()}-${Math.random()}`, 'token', JSON.stringify(keys)).lastInsertRowid)
  forgetTableInfo(tableId)
})

describe('campaign name for players', () => {
  it('goes out encrypted and signed by the DM', async () => {
    await syncTableInfo(db, tableId)
    expect(puts.map(p => p.slot)).toEqual(['info'])
    const content = await open((await loadGameKeys(keys)).gameKey, puts[0]!.envelope, await importVerifyKey(keys.signing.publicKey))
    expect(content).toEqual({ kind: 'info', campaignName: 'Der Fluch von Strahd' })
    expect(isTableInfoContent(content)).toBe(true)
  })

  it('unchanged: not sent again; renamed: sent again', async () => {
    await syncTableInfo(db, tableId)
    await syncTableInfo(db, tableId)
    expect(puts).toHaveLength(1)

    db.prepare('UPDATE campaigns SET name = ? WHERE id = ?').run('Strahd – Kapitel 2', campaignId)
    await syncTableInfo(db, tableId)
    expect(puts).toHaveLength(2)
  })
})
