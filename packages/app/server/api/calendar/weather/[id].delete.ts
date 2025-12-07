import { getDb } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = Number(getRouterParam(event, 'id'))

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Weather ID is required',
    })
  }

  const result = db.prepare('DELETE FROM calendar_weather WHERE id = ?').run(id)

  if (result.changes === 0) {
    throw createError({
      statusCode: 404,
      message: 'Weather entry not found',
    })
  }

  return { success: true }
})
