import { getDb } from '../../../../utils/db'
import { requireNumericParam } from '../../../../utils/game-table'

// Remove a player from the table
export default defineEventHandler((event) => {
  const id = requireNumericParam(getRouterParam(event, 'id'), 'player id')
  const result = getDb().prepare('DELETE FROM game_table_players WHERE id = ?').run(id)
  if (result.changes === 0) throw createError({ statusCode: 404, message: 'Player not found' })
  return { success: true }
})
