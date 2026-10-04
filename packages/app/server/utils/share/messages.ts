import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  CHAT_THREAD_MAX, derivePairKey, importExchangePublicKey, loadGameKeys, seal,
  type ChatThreadContent, type LoadedGameKeys, type StoredGameKeys,
} from '@dm-hero/seal'
import { getRelayAuth, putRelayThread } from '../relay'
import { withTableLock } from './sync'

// Private messages: DM Hero keeps each conversation (a short talk, not a chat
// archive: only the newest CHAT_THREAD_MAX) and sends it to the player's devices
// (one envelope per device, pair key). A change raises the conversation's dirty
// counter; it's only reset if nothing changed while sending - so even an emptied
// one is retried, also after a restart, and no change made meanwhile is lost.
// The hash in memory only avoids re-sending unchanged ones (e.g. every 5 s).
const sent = new Map<string, string>()

// What fits one relay envelope comfortably (encrypted + base64 adds ~35 %)
const THREAD_MAX_BYTES = 200 * 1024

/** The conversation changed - send it (again) until the relay has it */
export function markThreadDirty(db: Database.Database, playerId: number) {
  db.prepare('UPDATE game_table_players SET thread_dirty = thread_dirty + 1 WHERE id = ?').run(playerId)
}

/** A conversation keeps only its newest messages - older ones go */
export function pruneConversation(db: Database.Database, tableId: number, playerId: number) {
  db.prepare(`
    DELETE FROM game_table_messages WHERE game_table_id = ? AND player_id = ? AND id NOT IN (
      SELECT id FROM game_table_messages WHERE game_table_id = ? AND player_id = ? ORDER BY id DESC LIMIT ?
    )
  `).run(tableId, playerId, tableId, playerId, CHAT_THREAD_MAX)
}

/** Send all conversations again (new relay game) */
export function forgetThreads(tableId: number) {
  for (const key of sent.keys()) if (key.startsWith(`${tableId}:`)) sent.delete(key)
}

async function syncThread(db: Database.Database, tableId: number, playerId: number, gameId: string, getKeys: () => Promise<LoadedGameKeys>) {
  const auth = getRelayAuth(db, tableId)
  const player = db.prepare('SELECT thread_dirty FROM game_table_players WHERE id = ? AND game_table_id = ?').get(playerId, tableId) as { thread_dirty: number } | undefined
  if (!auth || !player) return
  // Generation of changes this snapshot covers
  const generation = player.thread_dirty
  const dirty = generation > 0

  const rows = db.prepare(`
    SELECT message_key, sender, text, created_at FROM game_table_messages
    WHERE game_table_id = ? AND player_id = ? ORDER BY id DESC LIMIT ?
  `).all(tableId, playerId, CHAT_THREAD_MAX) as Array<{ message_key: string, sender: 'dm' | 'player', text: string, created_at: string }>
  // Nothing to say - unless it was emptied (then the players' copy must empty too)
  if (!rows.length && !dirty) return

  const content: ChatThreadContent = {
    kind: 'thread',
    messages: rows.reverse().map(r => ({ id: r.message_key, from: r.sender, text: r.text, sentAt: r.created_at })),
  }
  // Very long texts: the oldest drop out of what is sent (all stay in DM Hero)
  while (content.messages.length && JSON.stringify(content).length > THREAD_MAX_BYTES) content.messages.shift()

  const devices = (db.prepare('SELECT public_key FROM game_table_devices WHERE game_table_id = ? AND player_id = ? ORDER BY id')
    .all(tableId, playerId) as Array<{ public_key: string }>).map(d => d.public_key)
  const hash = createHash('sha256').update(JSON.stringify({ gameId, content, devices })).digest('hex')
  const key = `${tableId}:${playerId}`
  if (sent.get(key) === hash && !dirty) return

  const keys = await getKeys()
  const envelopes: Record<string, unknown> = {}
  for (const publicKey of devices) {
    const pairKey = await derivePairKey(keys.exchangeKey, await importExchangePublicKey(publicKey), gameId)
    envelopes[publicKey] = await seal(pairKey, { v: 1, gameId, from: 'dm', to: String(playerId), epoch: keys.epoch, seq: Date.now() }, content, keys.signingKey)
  }
  await putRelayThread(auth, playerId, envelopes)
  sent.set(key, hash)
  // Changed while sending (e.g. cleared)? Then it stays dirty and goes out again
  db.prepare('UPDATE game_table_players SET thread_dirty = 0 WHERE id = ? AND thread_dirty = ?').run(playerId, generation)
}

async function runThreadSync(db: Database.Database, tableId: number, onlyPlayer: number | undefined) {
  const failed: number[] = []
  const table = db.prepare('SELECT relay_game_id, e2e_keys FROM game_tables WHERE id = ?').get(tableId) as { relay_game_id: string, e2e_keys: string | null } | undefined
  if (!table?.e2e_keys) return failed
  let keys: LoadedGameKeys | null = null
  const getKeys = async () => (keys ??= await loadGameKeys(JSON.parse(table.e2e_keys!) as StoredGameKeys))
  // Players with a conversation, plus emptied ones that still have to go out
  const players = onlyPlayer !== undefined
    ? [onlyPlayer]
    : (db.prepare(`
        SELECT DISTINCT player_id FROM game_table_messages WHERE game_table_id = ?
        UNION SELECT id FROM game_table_players WHERE game_table_id = ? AND thread_dirty > 0
      `).all(tableId, tableId) as Array<{ player_id: number }>).map(p => p.player_id)
  for (const playerId of players) {
    try {
      await syncThread(db, tableId, playerId, table.relay_game_id, getKeys)
    }
    catch (error) {
      console.error(`[Messages] Sync for player ${playerId} failed:`, error)
      failed.push(playerId)
    }
  }
  return failed
}

/** Send changed conversations (one player, or all of the game). Returns the players it couldn't reach. */
export function syncTableThreads(db: Database.Database, tableId: number, playerId?: number) {
  return withTableLock(tableId, () => runThreadSync(db, tableId, playerId))
}
