import { randomUUID } from 'node:crypto'
import { CHAT_TEXT_MAX } from '@dm-hero/seal'
import type { GameTableMessage } from '~~/types/game-table'
import { getDb } from '../../../../utils/db'
import { requireNumericParam } from '../../../../utils/game-table'
import { markThreadDirty, pruneConversation, syncTableThreads } from '../../../../utils/share/messages'

// The DM writes to one player - stored here, sent encrypted to that player's devices
export default defineEventHandler(async (event) => {
  const tableId = requireNumericParam(getRouterParam(event, 'id'), 'id')
  const body = await readBody<{ playerId?: number, text?: unknown }>(event)
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text || text.length > CHAT_TEXT_MAX) throw createError({ statusCode: 400, message: `Text (1-${CHAT_TEXT_MAX} characters) required` })

  const db = getDb()
  const playerId = Number(body?.playerId)
  if (!db.prepare('SELECT 1 FROM game_table_players WHERE id = ? AND game_table_id = ?').get(playerId, tableId)) {
    throw createError({ statusCode: 404, message: 'Player not found' })
  }
  const id = Number(db.prepare('INSERT INTO game_table_messages (game_table_id, player_id, message_key, sender, text, read_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)')
    .run(tableId, playerId, `d-${randomUUID()}`, 'dm', text).lastInsertRowid)

  pruneConversation(db, tableId, playerId)
  markThreadDirty(db, playerId)
  // Sent in the background - the DM never waits for the relay (the timer retries)
  syncTableThreads(db, tableId, playerId).catch(error => console.error('[Messages] Send failed:', error))
  return db.prepare('SELECT id, player_id, sender, text, created_at, read_at FROM game_table_messages WHERE id = ?').get(id) as GameTableMessage
})
