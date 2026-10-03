import { getDb } from '~~/server/utils/db'
import { syncTableMap } from '~~/server/utils/share/map'

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
  const tables = db.prepare('SELECT id FROM game_tables WHERE shown_map_id = ?').all(Number(id)) as Array<{ id: number }>
  db.prepare('UPDATE game_tables SET shown_map_id = NULL WHERE shown_map_id = ?').run(Number(id))
  for (const table of tables) {
    await syncTableMap(db, table.id).catch(error => console.error('[Relay] Map withdraw failed:', error))
  }

  return { success: true }
})
