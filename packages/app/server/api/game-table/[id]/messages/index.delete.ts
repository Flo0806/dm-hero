import { getDb } from '../../../../utils/db'
import { requireNumericParam } from '../../../../utils/game-table'
import { markThreadDirty, syncTableThreads } from '../../../../utils/share/messages'

// The DM clears the conversation with one player - for the player too
export default defineEventHandler((event) => {
  const tableId = requireNumericParam(getRouterParam(event, 'id'), 'id')
  const playerId = requireNumericParam(String(getQuery(event).playerId ?? ''), 'playerId')
  const db = getDb()
  db.prepare('DELETE FROM game_table_messages WHERE game_table_id = ? AND player_id = ?').run(tableId, playerId)
  // Marked first: the empty conversation reaches the player even if the relay is away right now
  markThreadDirty(db, playerId)
  syncTableThreads(db, tableId, playerId).catch(error => console.error('[Messages] Clear sync failed:', error))
  return { success: true }
})
