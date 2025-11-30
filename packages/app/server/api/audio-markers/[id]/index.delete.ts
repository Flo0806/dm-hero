import { getDb } from '../../../utils/db'

export default defineEventHandler((event) => {
  const db = getDb()
  const markerId = getRouterParam(event, 'id')

  if (!markerId) {
    throw createError({
      statusCode: 400,
      message: 'Marker ID is required',
    })
  }

  const result = db.prepare('DELETE FROM audio_markers WHERE id = ?').run(markerId)

  if (result.changes === 0) {
    throw createError({
      statusCode: 404,
      message: 'Marker not found',
    })
  }

  return { success: true }
})
