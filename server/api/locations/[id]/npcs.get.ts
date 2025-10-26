import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const locationId = getRouterParam(event, 'id')

  if (!locationId) {
    throw createError({
      statusCode: 400,
      message: 'Location ID is required',
    })
  }

  // Get all NPCs related to this location via entity_relations
  const npcs = db.prepare(`
    SELECT
      e.*,
      er.relation_type,
      er.notes as relation_notes
    FROM entities e
    INNER JOIN entity_relations er ON e.id = er.from_entity_id
    INNER JOIN entity_types et ON e.type_id = et.id
    WHERE er.to_entity_id = ?
      AND et.name = 'NPC'
      AND e.deleted_at IS NULL
    ORDER BY e.name ASC
  `).all(locationId)

  return npcs.map((npc: any) => ({
    ...npc,
    metadata: npc.metadata ? JSON.parse(npc.metadata) : null,
  }))
})
