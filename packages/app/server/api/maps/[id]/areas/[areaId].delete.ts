import { getDb } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const mapId = getRouterParam(event, 'id')
  const areaId = getRouterParam(event, 'areaId')

  if (!mapId || !areaId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Map ID and Area ID are required',
    })
  }

  // Check if area exists
  const existing = db
    .prepare('SELECT * FROM map_areas WHERE id = ? AND map_id = ?')
    .get(Number(areaId), Number(mapId))

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Area not found',
    })
  }

  // Delete the area
  db.prepare('DELETE FROM map_areas WHERE id = ?').run(Number(areaId))

  return { success: true }
})
