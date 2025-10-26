import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Session ID is required',
    })
  }

  // Soft-delete the session
  db.prepare(`
    UPDATE sessions
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id)

  return { success: true }
})
