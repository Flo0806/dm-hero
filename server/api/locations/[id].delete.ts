import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Location ID is required',
    })
  }

  // Soft-delete the location
  db.prepare(`
    UPDATE entities
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id)

  return { success: true }
})
