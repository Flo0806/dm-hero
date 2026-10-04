import { describe, it, expect, beforeEach, vi } from 'vitest'
import type Database from 'better-sqlite3'
import {
  createGameKeys, derivePairKey, exportPublicKey, generateExchangeKeyPair, importExchangePublicKey, importVerifyKey,
  open, seal, type ChatThreadContent, type Envelope, type StoredGameKeys,
} from '@dm-hero/seal'
import { getTestDb } from '../utils/test-db'

// Private messages: player -> DM decrypted + stored once, DM -> player per device
let db: Database.Database
const acked: string[] = []
const threads = new Map<number, Record<string, Envelope>>()

vi.mock('../../server/utils/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../server/utils/db')>()
  return { ...original, getDb: () => db }
})
vi.mock('../../server/utils/relay', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../server/utils/relay')>()
  return {
    ...original,
    ackRelayMessage: async (_a: unknown, id: string) => {
      acked.push(id)
    },
    putRelayThread: async (_a: unknown, playerId: number, envelopes: Record<string, Envelope>) => {
      threads.set(playerId, envelopes)
    },
  }
})

const { handleMessage } = await import('../../server/utils/relay-presence')
const { syncTableThreads } = await import('../../server/utils/share/messages')

const GAME = 'relay-chat'
let tableId: number
let keys: StoredGameKeys

async function addPlayer(name: string, approved = true) {
  const playerId = Number(db.prepare('INSERT INTO game_table_players (game_table_id, name, pin) VALUES (?, ?, ?)').run(tableId, name, String(Math.random()).slice(2, 8)).lastInsertRowid)
  const device = await generateExchangeKeyPair()
  const publicKey = await exportPublicKey(device.publicKey)
  if (approved) db.prepare('INSERT INTO game_table_devices (game_table_id, player_id, public_key) VALUES (?, ?, ?)').run(tableId, playerId, publicKey)
  const pairKey = await derivePairKey(device.privateKey, await importExchangePublicKey(keys.exchange.publicKey), GAME)
  return { playerId, publicKey, pairKey }
}

const post = async (player: Awaited<ReturnType<typeof addPlayer>>, relayId: string, id: string, text: string) => handleMessage(tableId, {
  id: relayId,
  playerId: String(player.playerId),
  publicKey: player.publicKey,
  envelope: await seal(player.pairKey, { v: 1, gameId: GAME, from: 'player', to: 'dm', epoch: 1, seq: Date.now() }, { kind: 'chat', id, text }),
})

const stored = () => db.prepare('SELECT player_id, sender, text FROM game_table_messages ORDER BY id').all()

beforeEach(async () => {
  acked.length = 0
  threads.clear()
  db = getTestDb()
  const campaignId = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Chat').lastInsertRowid)
  keys = await createGameKeys()
  tableId = Number(db.prepare('INSERT INTO game_tables (campaign_id, code, relay_game_id, relay_dm_token, e2e_keys) VALUES (?, ?, ?, ?, ?)')
    .run(campaignId, 'CHATCH', GAME, 'token', JSON.stringify(keys)).lastInsertRowid)
})

describe('private messages', () => {
  it('a player message is decrypted, stored once and taken off the relay', async () => {
    const anna = await addPlayer('Anna')
    await post(anna, 'relay-1', 'm1', '  Darf ich den Brief lesen?  ')
    await post(anna, 'relay-2', 'm1', 'Darf ich den Brief lesen?')
    expect(stored()).toEqual([{ player_id: anna.playerId, sender: 'player', text: 'Darf ich den Brief lesen?' }])
    expect(acked).toEqual(['relay-1', 'relay-2'])
  })

  it('messages from unapproved devices are dropped', async () => {
    const stranger = await addPlayer('Mallory', false)
    await post(stranger, 'relay-3', 'm2', 'Hallo?')
    expect(stored()).toEqual([])
    expect(acked).toEqual(['relay-3'])
  })

  it('the conversation is sealed for that player\'s devices only, signed by the DM', async () => {
    const anna = await addPlayer('Anna')
    const ben = await addPlayer('Ben')
    await post(anna, 'relay-4', 'm3', 'Hallo DM')
    db.prepare('INSERT INTO game_table_messages (game_table_id, player_id, message_key, sender, text) VALUES (?, ?, ?, ?, ?)').run(tableId, anna.playerId, 'd-1', 'dm', 'Hallo Anna')
    await syncTableThreads(db, tableId, anna.playerId)

    const envelope = threads.get(anna.playerId)![anna.publicKey]!
    const thread = await open<ChatThreadContent>(anna.pairKey, envelope, await importVerifyKey(keys.signing.publicKey))
    expect(thread.messages.map(m => [m.from, m.text, m.id])).toEqual([['player', 'Hallo DM', `p-${anna.playerId}-m3`], ['dm', 'Hallo Anna', 'd-1']])
    // Ben's device can't read Anna's conversation, and he got none
    await expect(open(ben.pairKey, envelope)).rejects.toThrow()
    expect(threads.has(ben.playerId)).toBe(false)
  })
})
