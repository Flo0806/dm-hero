import { getDb } from '../../../utils/db'
import { requireNumericParam } from '../../../utils/game-table'

// The one map the players see (null = none). Only maps of the game's campaign.
export default defineEventHandler(async (event) => {
  const tableId = requireNumericParam(getRouterParam(event, 'id'), 'id')
  const { mapId } = await readBody<{ mapId: number | null }>(event) ?? {}
  if (mapId !== null && !Number.isInteger(mapId)) throw createError({ statusCode: 400, message: 'mapId must be a number or null' })

  const db = getDb()
  if (!db.prepare('SELECT 1 FROM game_tables WHERE id = ?').get(tableId)) throw createError({ statusCode: 404, message: 'Game not found' })
  if (mapId !== null) {
    const sameCampaign = db.prepare(`
      SELECT 1 FROM campaign_maps m JOIN game_tables g ON g.campaign_id = m.campaign_id
      WHERE m.id = ? AND g.id = ? AND m.deleted_at IS NULL
    `).get(mapId, tableId)
    if (!sameCampaign) throw createError({ statusCode: 400, message: 'Map belongs to another campaign' })
  }
  db.prepare('UPDATE game_tables SET shown_map_id = ? WHERE id = ?').run(mapId, tableId)
  return { shownMapId: mapId }
})
