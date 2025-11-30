import { getDb } from '../../utils/db'
import type { ItemTypeRow, EntityTypeRow, CountRow } from '../../types/database'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Item type ID is required',
    })
  }

  // Check if type exists
  const itemType = db
    .prepare<[string], ItemTypeRow>(
      `
    SELECT * FROM item_types WHERE id = ? AND deleted_at IS NULL
  `,
    )
    .get(id)

  if (!itemType) {
    throw createError({
      statusCode: 404,
      message: 'Item type not found',
    })
  }

  // Check if type is in use by any Items
  const itemEntityTypeId = db
    .prepare<[], EntityTypeRow>(
      `
    SELECT id FROM entity_types WHERE name = 'Item'
  `,
    )
    .get()

  const inUse = db
    .prepare<[number | undefined, string], CountRow>(
      `
    SELECT COUNT(*) as count FROM entities
    WHERE type_id = ? AND deleted_at IS NULL
    AND json_extract(metadata, '$.type') = ?
  `,
    )
    .get(itemEntityTypeId?.id, itemType.name)

  if (inUse && inUse.count > 0) {
    throw createError({
      statusCode: 409,
      message: `Cannot delete item type '${itemType.name}' because it is used by ${inUse.count} item(s)`,
    })
  }

  // Soft-delete the type
  db.prepare(
    `
    UPDATE item_types
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
  ).run(id)

  return { success: true }
})
