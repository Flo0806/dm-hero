import { getDb } from '../../../../utils/db'
import { generateUniquePin, getTablePlayers, requireNumericParam } from '../../../../utils/game-table'

// Roll a new PIN for a player (e.g. if the old one got out)
export default defineEventHandler((event) => {
  const db = getDb()
  const id = requireNumericParam(getRouterParam(event, 'id'), 'player id')
  const player = db.prepare('SELECT game_table_id FROM game_table_players WHERE id = ?').get(id) as { game_table_id: number } | undefined
  if (!player) throw createError({ statusCode: 404, message: 'Player not found' })

  db.prepare('UPDATE game_table_players SET pin = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(generateUniquePin(db, player.game_table_id), id)
  return getTablePlayers(db, player.game_table_id).find(p => p.id === id)
})
