import type { GameTableMessage } from '~~/types/game-table'
import { getDb } from '../../../../utils/db'
import { requireNumericParam } from '../../../../utils/game-table'

// All private messages of this game (the DM's side keeps the whole conversation)
export default defineEventHandler((event) => {
  const tableId = requireNumericParam(getRouterParam(event, 'id'), 'game table id')
  return getDb().prepare('SELECT id, player_id, sender, text, created_at, read_at FROM game_table_messages WHERE game_table_id = ? ORDER BY id')
    .all(tableId) as GameTableMessage[]
})
