import { getDb } from '../../../utils/db'

/**
 * Recursively soft-delete a location and all its children
 */
function cascadeDeleteLocation(db: ReturnType<typeof getDb>, locationId: number): number {
  // Find all children of this location
  const children = db
    .prepare(
      `
    SELECT id FROM entities
    WHERE parent_entity_id = ? AND deleted_at IS NULL
  `,
    )
    .all(locationId) as Array<{ id: number }>

  let deletedCount = 0

  // Recursively delete all children first
  for (const child of children) {
    deletedCount += cascadeDeleteLocation(db, child.id)
  }

  // Then delete this location
  db.prepare(
    `
    UPDATE entities
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
  ).run(locationId)

  return deletedCount + 1
}

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Location ID is required',
    })
  }

  // Cascade delete: delete location and all its children
  const deletedCount = cascadeDeleteLocation(db, Number(id))

  return {
    success: true,
    deletedCount,
    message:
      deletedCount === 1
        ? 'Location deleted'
        : `Location and ${deletedCount - 1} child location(s) deleted`,
  }
})
