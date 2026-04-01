import { getDb } from '../../../utils/db'

export default defineEventHandler((event) => {
  const db = getDb()
  const npcId = getRouterParam(event, 'id')

  if (!npcId) {
    throw createError({ statusCode: 400, message: 'NPC ID is required' })
  }

  const playerTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'Player'").get() as { id: number } | undefined
  if (!playerTypeId) return []

  // Bidirectional: find players linked to this NPC in either direction
  const players = db.prepare(`
    SELECT DISTINCT e.id, e.name, e.image_url
    FROM entities e
    INNER JOIN entity_relations er ON (
      (er.from_entity_id = ? AND er.to_entity_id = e.id)
      OR (er.to_entity_id = ? AND er.from_entity_id = e.id)
    )
    WHERE e.type_id = ?
      AND e.deleted_at IS NULL
    ORDER BY e.name
  `).all(npcId, npcId, playerTypeId.id) as Array<{ id: number, name: string, image_url: string | null }>

  return players
})
