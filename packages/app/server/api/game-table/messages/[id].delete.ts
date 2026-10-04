import { getDb } from '../../../utils/db'
import { requireNumericParam } from '../../../utils/game-table'
import { syncTableThreads } from '../../../utils/share/messages'

// The DM deletes one message (own or the player's) - it disappears for the player too
export default defineEventHandler(async (event) => {
  const id = requireNumericParam(getRouterParam(event, 'id'), 'message id')
  const db = getDb()
  const message = db.prepare('SELECT game_table_id, player_id FROM game_table_messages WHERE id = ?').get(id) as { game_table_id: number, player_id: number } | undefined
  if (!message) throw createError({ statusCode: 404, message: 'Message not found' })
  db.prepare('DELETE FROM game_table_messages WHERE id = ?').run(id)
  const failed = await syncTableThreads(db, message.game_table_id, message.player_id, { force: true })
  return { pending: failed.length > 0 }
})
