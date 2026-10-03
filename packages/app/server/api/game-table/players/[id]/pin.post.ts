import { getDb } from '../../../../utils/db'
import { generateUniquePin, getTablePlayers, requireNumericParam } from '../../../../utils/game-table'
import { syncRelayPlayers } from '../../../../utils/relay'
import { rotateTableKey } from '../../../../utils/relay-keys'

// Roll a new PIN for a player (e.g. if the old one got out)
export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = requireNumericParam(getRouterParam(event, 'id'), 'player id')
  const player = db.prepare('SELECT game_table_id FROM game_table_players WHERE id = ?').get(id) as { game_table_id: number } | undefined
  if (!player) throw createError({ statusCode: 404, message: 'Player not found' })

  db.prepare('UPDATE game_table_players SET pin = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(generateUniquePin(db, player.game_table_id), id)
  // New PIN = old access is void: devices must be approved again
  db.prepare('DELETE FROM game_table_devices WHERE player_id = ?').run(id)
  // New PIN on the relay kicks the player's old session
  await syncRelayPlayers(db, player.game_table_id)
  // Old access is void - including the game key the old devices hold
  await rotateTableKey(player.game_table_id)
  return getTablePlayers(db, player.game_table_id).find(p => p.id === id)
})
