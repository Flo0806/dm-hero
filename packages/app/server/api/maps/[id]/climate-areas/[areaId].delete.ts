import { getDb } from '~~/server/utils/db'

export default defineEventHandler((event): { success: true } => {
  const db = getDb()
  const areaId = Number(getRouterParam(event, 'areaId'))

  if (!Number.isFinite(areaId)) {
    throw createError({ statusCode: 400, statusMessage: 'Area ID is required' })
  }

  const result = db.prepare('DELETE FROM map_climate_areas WHERE id = ?').run(areaId)
  if (result.changes === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Climate area not found' })
  }

  return { success: true }
})
