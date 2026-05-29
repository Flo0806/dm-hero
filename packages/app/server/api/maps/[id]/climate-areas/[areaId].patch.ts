import { getDb } from '~~/server/utils/db'
import type { MapClimateArea, UpdateMapClimateAreaPayload } from '~~/types/map'

export default defineEventHandler(async (event): Promise<MapClimateArea> => {
  const db = getDb()
  const mapId = Number(getRouterParam(event, 'id'))
  const areaId = Number(getRouterParam(event, 'areaId'))
  const body = await readBody<UpdateMapClimateAreaPayload>(event)

  if (!Number.isFinite(mapId)) {
    throw createError({ statusCode: 400, statusMessage: 'Map ID is required' })
  }
  if (!Number.isFinite(areaId)) {
    throw createError({ statusCode: 400, statusMessage: 'Area ID is required' })
  }

  // Scope to the parent map so the area can't be edited via a mismatched map id.
  const existing = db.prepare('SELECT id FROM map_climate_areas WHERE id = ? AND map_id = ?').get(areaId, mapId)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Climate area not found' })
  }

  const updates: string[] = []
  const params: unknown[] = []
  if (body.center_x !== undefined) {
    updates.push('center_x = ?')
    params.push(body.center_x)
  }
  if (body.center_y !== undefined) {
    updates.push('center_y = ?')
    params.push(body.center_y)
  }
  if (body.radius !== undefined) {
    updates.push('radius = ?')
    params.push(body.radius)
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP')
    params.push(areaId, mapId)
    db.prepare(`UPDATE map_climate_areas SET ${updates.join(', ')} WHERE id = ? AND map_id = ?`).run(...params)
  }

  return db
    .prepare(
      `SELECT mca.*, cz.name as zone_name, cz.color as zone_color, cz.icon as zone_icon
       FROM map_climate_areas mca
       JOIN climate_zones cz ON mca.zone_id = cz.id
       WHERE mca.id = ? AND mca.map_id = ?`,
    )
    .get(areaId, mapId) as MapClimateArea
})
