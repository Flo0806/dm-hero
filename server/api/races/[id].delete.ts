import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Race ID is required',
    })
  }

  // Check if race exists
  const race = db.prepare(`
    SELECT * FROM races WHERE id = ? AND deleted_at IS NULL
  `).get(id)

  if (!race) {
    throw createError({
      statusCode: 404,
      message: 'Race not found',
    })
  }

  // Check if race is in use by any NPCs
  const npcTypeId = db.prepare(`
    SELECT id FROM entity_types WHERE name = 'NPC'
  `).get()

  const inUse = db.prepare(`
    SELECT COUNT(*) as count FROM entities
    WHERE type_id = ? AND deleted_at IS NULL
    AND json_extract(metadata, '$.race') = ?
  `).get(npcTypeId?.id, race.name)

  if (inUse && inUse.count > 0) {
    throw createError({
      statusCode: 409,
      message: `Cannot delete race '${race.name}' because it is used by ${inUse.count} NPC(s)`,
    })
  }

  // Soft-delete the race
  db.prepare(`
    UPDATE races
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id)

  return { success: true }
})
