import { getDb } from '../../utils/db'

export default defineEventHandler((event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'NPC ID is required',
    })
  }

  // Soft-delete: set deleted_at timestamp
  db.prepare(`
    UPDATE entities
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE id = ? AND deleted_at IS NULL
  `).run(id)

  return { success: true }
})
