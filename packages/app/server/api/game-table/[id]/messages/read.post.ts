import { getDb } from '../../../../utils/db'
import { requireNumericParam } from '../../../../utils/game-table'

// The DM opened a conversation - its unread messages count as read.
// Returns exactly which ones, so the page doesn't mark a message that arrived meanwhile.
export default defineEventHandler(async (event) => {
  const tableId = requireNumericParam(getRouterParam(event, 'id'), 'id')
  const playerId = requireNumericParam(String((await readBody<{ playerId?: number }>(event))?.playerId ?? ''), 'playerId')
  const db = getDb()
  const ids = (db.prepare('SELECT id FROM game_table_messages WHERE game_table_id = ? AND player_id = ? AND read_at IS NULL')
    .all(tableId, playerId) as Array<{ id: number }>).map(row => row.id)
  if (ids.length) {
    db.prepare(`UPDATE game_table_messages SET read_at = CURRENT_TIMESTAMP WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids)
  }
  return { ids }
})
