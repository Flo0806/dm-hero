import { getDb } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const mapId = getRouterParam(event, 'id')
  const markerId = getRouterParam(event, 'markerId')

  if (!mapId || !markerId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Map ID and Marker ID are required',
    })
  }

  // Hard delete (markers don't need soft delete)
  const result = db
    .prepare('DELETE FROM map_markers WHERE id = ? AND map_id = ?')
    .run(Number(markerId), Number(mapId))

  if (result.changes === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Marker not found',
    })
  }

  return { success: true }
})
