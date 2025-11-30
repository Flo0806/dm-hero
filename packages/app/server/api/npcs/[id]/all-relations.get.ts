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

  interface DbRelation {
    id: number
    from_entity_id: number
    to_entity_id: number
    relation_type: string
    notes: string | null
    created_at: string
    to_entity_name: string
    to_entity_type: string
    to_entity_image_url: string | null
  }

  // Get ALL relations (NPCs, Locations, Factions, Items, etc.)
  const relations = db
    .prepare<unknown[], DbRelation>(
      `
    SELECT
      er.id,
      er.from_entity_id,
      er.to_entity_id,
      er.relation_type,
      er.notes,
      er.created_at,
      e.name as to_entity_name,
      et.name as to_entity_type,
      e.image_url as to_entity_image_url
    FROM entity_relations er
    INNER JOIN entities e ON er.to_entity_id = e.id
    INNER JOIN entity_types et ON e.type_id = et.id
    WHERE er.from_entity_id = ?
      AND e.deleted_at IS NULL
    ORDER BY et.name, e.name
  `,
    )
    .all(npcId)

  return relations.map((rel) => {
    // Parse notes safely
    let parsedNotes = null
    if (rel.notes) {
      try {
        parsedNotes = JSON.parse(rel.notes)
      } catch {
        parsedNotes = rel.notes
      }
    }

    return {
      id: rel.id,
      to_entity_id: rel.to_entity_id,
      to_entity_name: rel.to_entity_name,
      to_entity_type: rel.to_entity_type,
      relation_type: rel.relation_type,
      notes: parsedNotes,
      image_url: rel.to_entity_image_url,
    }
  })
})
