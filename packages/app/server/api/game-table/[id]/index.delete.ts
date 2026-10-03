import { getDb } from '../../../utils/db'
import { requireNumericParam } from '../../../utils/game-table'

// Close the game: removes the table and all its players for good
export default defineEventHandler((event) => {
  const id = requireNumericParam(getRouterParam(event, 'id'), 'game table id')
  const result = getDb().prepare('DELETE FROM game_tables WHERE id = ?').run(id)
  if (result.changes === 0) throw createError({ statusCode: 404, message: 'Game not found' })
  return { success: true }
})
