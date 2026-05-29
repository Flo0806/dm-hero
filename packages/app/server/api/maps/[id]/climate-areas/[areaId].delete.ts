import { getDb } from '~~/server/utils/db'

export default defineEventHandler((event): { success: true } => {
  const db = getDb()
  const mapId = Number(getRouterParam(event, 'id'))
  const areaId = Number(getRouterParam(event, 'areaId'))

  if (!Number.isFinite(mapId)) {
    throw createError({ statusCode: 400, statusMessage: 'Map ID is required' })
  }
  if (!Number.isFinite(areaId)) {
    throw createError({ statusCode: 400, statusMessage: 'Area ID is required' })
  }

  // Scope to the parent map so an area can't be deleted via a mismatched map id.
  const result = db.prepare('DELETE FROM map_climate_areas WHERE id = ? AND map_id = ?').run(areaId, mapId)
  if (result.changes === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Climate area not found' })
  }

  return { success: true }
})
