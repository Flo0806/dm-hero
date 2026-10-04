import { getDb } from '../../../../utils/db'
import { requireNumericParam } from '../../../../utils/game-table'

// The DM opened a conversation - its messages count as read
export default defineEventHandler(async (event) => {
  const tableId = requireNumericParam(getRouterParam(event, 'id'), 'id')
  const playerId = Number((await readBody<{ playerId?: number }>(event))?.playerId)
  getDb().prepare('UPDATE game_table_messages SET read_at = CURRENT_TIMESTAMP WHERE game_table_id = ? AND player_id = ? AND read_at IS NULL')
    .run(tableId, playerId)
  return { success: true }
})
