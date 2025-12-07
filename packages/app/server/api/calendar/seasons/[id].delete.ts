import { getDb } from '../../../utils/db'

export default defineEventHandler((event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Season ID is required',
    })
  }

  db.prepare('DELETE FROM calendar_seasons WHERE id = ?').run(Number(id))

  return { success: true }
})
