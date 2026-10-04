import { getDb } from '../../../../utils/db'
import { requireNumericParam } from '../../../../utils/game-table'
import { syncTableThreads } from '../../../../utils/share/messages'

// The DM clears the conversation with one player - for the player too
export default defineEventHandler(async (event) => {
  const tableId = requireNumericParam(getRouterParam(event, 'id'), 'id')
  const playerId = requireNumericParam(String(getQuery(event).playerId ?? ''), 'playerId')
  const db = getDb()
  db.prepare('DELETE FROM game_table_messages WHERE game_table_id = ? AND player_id = ?').run(tableId, playerId)
  const failed = await syncTableThreads(db, tableId, playerId, { force: true })
  return { pending: failed.length > 0 }
})
