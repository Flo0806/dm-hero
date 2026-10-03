import { getDb } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Map ID is required',
    })
  }

  // Soft delete
  const result = db
    .prepare(
      `
      UPDATE campaign_maps
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL
    `,
    )
    .run(Number(id))

  if (result.changes === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Map not found',
    })
  }

  // Soft delete doesn't trigger ON DELETE SET NULL - players stop seeing it here
  db.prepare('UPDATE game_tables SET shown_map_id = NULL WHERE shown_map_id = ?').run(Number(id))

  return { success: true }
})
