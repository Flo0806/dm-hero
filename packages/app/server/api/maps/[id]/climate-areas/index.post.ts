import { getDb } from '~~/server/utils/db'
import type { MapClimateArea, CreateMapClimateAreaPayload } from '~~/types/map'

export default defineEventHandler(async (event): Promise<MapClimateArea> => {
  const db = getDb()
  const mapId = Number(getRouterParam(event, 'id'))
  const body = await readBody<CreateMapClimateAreaPayload>(event)

  if (!Number.isFinite(mapId)) {
    throw createError({ statusCode: 400, statusMessage: 'Map ID is required' })
  }
  if (!body.zone_id || body.center_x === undefined || body.center_y === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'zone_id, center_x, and center_y are required' })
  }

  const map = db.prepare('SELECT id FROM campaign_maps WHERE id = ? AND deleted_at IS NULL').get(mapId)
  if (!map) {
    throw createError({ statusCode: 404, statusMessage: 'Map not found' })
  }

  const zone = db.prepare('SELECT id FROM climate_zones WHERE id = ? AND deleted_at IS NULL').get(body.zone_id)
  if (!zone) {
    throw createError({ statusCode: 404, statusMessage: 'Climate zone not found' })
  }

  const result = db
    .prepare(
      `INSERT INTO map_climate_areas (map_id, zone_id, center_x, center_y, radius)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(mapId, body.zone_id, body.center_x, body.center_y, body.radius ?? 8.0)

  return db
    .prepare(
      `SELECT mca.*, cz.name as zone_name, cz.color as zone_color, cz.icon as zone_icon
       FROM map_climate_areas mca
       JOIN climate_zones cz ON mca.zone_id = cz.id
       WHERE mca.id = ?`,
    )
    .get(result.lastInsertRowid) as MapClimateArea
})
