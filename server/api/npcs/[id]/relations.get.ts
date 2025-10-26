import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const npcId = getRouterParam(event, 'id')

  if (!npcId) {
    throw createError({
      statusCode: 400,
      message: 'NPC ID is required',
    })
  }

  // Get all relations where this NPC is the 'from' entity
  const relations = db.prepare(`
    SELECT
      er.*,
      e.name as to_entity_name,
      et.name as to_entity_type
    FROM entity_relations er
    INNER JOIN entities e ON er.to_entity_id = e.id
    INNER JOIN entity_types et ON e.type_id = et.id
    WHERE er.from_entity_id = ?
      AND e.deleted_at IS NULL
    ORDER BY et.name, e.name
  `).all(npcId)

  return relations
})
