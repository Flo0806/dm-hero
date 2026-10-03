import { getDb } from '../../../../utils/db'
import { assertPlayerEntity, getTablePlayers, requireNumericParam } from '../../../../utils/game-table'
import { syncRelayPlayers } from '../../../../utils/relay'

// Rename a player or change the linked Player entity
export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = requireNumericParam(getRouterParam(event, 'id'), 'player id')
  const body = await readBody<{ name?: string, playerEntityId?: number | null }>(event)

  const player = db.prepare('SELECT game_table_id FROM game_table_players WHERE id = ?').get(id) as { game_table_id: number } | undefined
  if (!player) throw createError({ statusCode: 404, message: 'Player not found' })

  if (body?.name !== undefined) {
    const name = body.name.trim()
    if (!name) throw createError({ statusCode: 400, message: 'Player name is required' })
    db.prepare('UPDATE game_table_players SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name, id)
  }
  if (body?.playerEntityId !== undefined) {
    assertPlayerEntity(db, player.game_table_id, body.playerEntityId)
    db.prepare('UPDATE game_table_players SET player_entity_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(body.playerEntityId, id)
  }
  await syncRelayPlayers(db, player.game_table_id)
  return getTablePlayers(db, player.game_table_id).find(p => p.id === id)
})
