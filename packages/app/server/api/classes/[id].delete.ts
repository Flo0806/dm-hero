import { getDb } from '../../utils/db'
import type { ClassRow, EntityTypeRow, CountRow } from '../../types/database'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Class ID is required',
    })
  }

  // Check if class exists
  const classData = db
    .prepare<unknown[], ClassRow>(
      `
    SELECT * FROM classes WHERE id = ? AND deleted_at IS NULL
  `,
    )
    .get(id)

  if (!classData) {
    throw createError({
      statusCode: 404,
      message: 'Class not found',
    })
  }

  // Prevent deleting standard classes
  if (classData.is_standard) {
    throw createError({
      statusCode: 403,
      message: 'Standard classes cannot be deleted',
    })
  }

  // Check if class is in use by any NPCs
  const npcTypeId = db
    .prepare<unknown[], EntityTypeRow>(
      `
    SELECT id FROM entity_types WHERE name = 'NPC'
  `,
    )
    .get()

  const inUse = db
    .prepare<unknown[], CountRow>(
      `
    SELECT COUNT(*) as count FROM entities
    WHERE type_id = ? AND deleted_at IS NULL
    AND json_extract(metadata, '$.class') = ?
  `,
    )
    .get(npcTypeId?.id, classData.name)

  if (inUse && inUse.count > 0) {
    throw createError({
      statusCode: 409,
      data: { code: 'CLASS_IN_USE', count: inUse.count, name: classData.name },
      message: `CLASS_IN_USE:${inUse.count}`,
    })
  }

  // Soft-delete the class
  db.prepare(
    `
    UPDATE classes
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
  ).run(id)

  return { success: true }
})
