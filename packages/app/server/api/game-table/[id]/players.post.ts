import { getDb } from '../../../utils/db'
import { assertPlayerEntity, generateUniquePin, getTablePlayers, requireNumericParam } from '../../../utils/game-table'
import { syncRelayPlayers } from '../../../utils/relay'

// Add a player to the table; the PIN is generated here
export default defineEventHandler(async (event) => {
  const db = getDb()
  const tableId = requireNumericParam(getRouterParam(event, 'id'), 'game table id')
  const body = await readBody<{ name?: string, playerEntityId?: number | null }>(event)
  const name = body?.name?.trim()
  if (!name) throw createError({ statusCode: 400, message: 'Player name is required' })

  if (!db.prepare('SELECT 1 FROM game_tables WHERE id = ?').get(tableId)) {
    throw createError({ statusCode: 404, message: 'Game not found' })
  }
  assertPlayerEntity(db, tableId, body?.playerEntityId)

  const result = db.prepare('INSERT INTO game_table_players (game_table_id, name, pin, player_entity_id) VALUES (?, ?, ?, ?)')
    .run(tableId, name, generateUniquePin(db, tableId), body?.playerEntityId ?? null)
  await syncRelayPlayers(db, tableId)
  return getTablePlayers(db, tableId).find(p => p.id === Number(result.lastInsertRowid))
})
