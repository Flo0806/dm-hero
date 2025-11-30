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
    related_npc_id: number
    related_npc_name: string
    related_npc_type: string
    related_npc_image_url: string | null
    direction: 'outgoing' | 'incoming'
  }

  // Get the NPC entity type ID
  const npcTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'NPC'").get() as
    | { id: number }
    | undefined

  if (!npcTypeId) {
    throw createError({
      statusCode: 500,
      message: 'NPC entity type not found',
    })
  }

  // Get bidirectional NPC-to-NPC relations
  // UNION: Relations where this NPC is 'from' (outgoing) OR 'to' (incoming)
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
      e.id as related_npc_id,
      e.name as related_npc_name,
      et.name as related_npc_type,
      e.image_url as related_npc_image_url,
      'outgoing' as direction
    FROM entity_relations er
    INNER JOIN entities e ON er.to_entity_id = e.id
    INNER JOIN entity_types et ON e.type_id = et.id
    WHERE er.from_entity_id = ?
      AND e.type_id = ?
      AND e.deleted_at IS NULL

    UNION ALL

    SELECT
      er.id,
      er.from_entity_id,
      er.to_entity_id,
      er.relation_type,
      er.notes,
      er.created_at,
      e.id as related_npc_id,
      e.name as related_npc_name,
      et.name as related_npc_type,
      e.image_url as related_npc_image_url,
      'incoming' as direction
    FROM entity_relations er
    INNER JOIN entities e ON er.from_entity_id = e.id
    INNER JOIN entity_types et ON e.type_id = et.id
    WHERE er.to_entity_id = ?
      AND e.type_id = ?
      AND e.deleted_at IS NULL

    ORDER BY related_npc_name
  `,
    )
    .all(npcId, npcTypeId.id, npcId, npcTypeId.id)

  return relations.map((rel) => {
    // Parse notes safely - handle both JSON and plain text
    let parsedNotes = null
    if (rel.notes) {
      try {
        parsedNotes = JSON.parse(rel.notes)
      } catch {
        // If not valid JSON, treat as plain text
        parsedNotes = rel.notes
      }
    }

    return {
      id: rel.id, // Relation ID for editing/deleting
      related_npc_id: rel.related_npc_id,
      related_npc_name: rel.related_npc_name,
      related_npc_type: rel.related_npc_type,
      relation_type: rel.relation_type,
      notes: parsedNotes,
      image_url: rel.related_npc_image_url,
      direction: rel.direction,
    }
  })
})
