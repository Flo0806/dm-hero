import { getDb } from '../../../utils/db'
import { requireNumericParam } from '../../../utils/game-table'
import { markThreadDirty, syncTableThreads } from '../../../utils/share/messages'

// The DM deletes one message (own or the player's) - it disappears for the player too
export default defineEventHandler((event) => {
  const id = requireNumericParam(getRouterParam(event, 'id'), 'message id')
  const db = getDb()
  const message = db.prepare('SELECT game_table_id, player_id FROM game_table_messages WHERE id = ?').get(id) as { game_table_id: number, player_id: number } | undefined
  if (!message) throw createError({ statusCode: 404, message: 'Message not found' })
  db.prepare('DELETE FROM game_table_messages WHERE id = ?').run(id)
  // Marked first: reaches the player even if the relay is away right now
  markThreadDirty(db, message.player_id)
  syncTableThreads(db, message.game_table_id, message.player_id).catch(error => console.error('[Messages] Delete sync failed:', error))
  return { success: true }
})
