import { getDb } from '../../../../utils/db'
import { requireNumericParam } from '../../../../utils/game-table'
import { syncRelayPlayers } from '../../../../utils/relay'
import { rotateTableKey } from '../../../../utils/relay-keys'

// Remove a player from the table
export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = requireNumericParam(getRouterParam(event, 'id'), 'player id')
  const player = db.prepare('SELECT game_table_id FROM game_table_players WHERE id = ?').get(id) as { game_table_id: number } | undefined
  if (!player) throw createError({ statusCode: 404, message: 'Player not found' })

  db.prepare('DELETE FROM game_table_players WHERE id = ?').run(id)
  // Removed on the relay too - kicks the player; new game key so they can't read anything new
  await syncRelayPlayers(db, player.game_table_id)
  await rotateTableKey(player.game_table_id)
  return { success: true }
})
