import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const factionId = getRouterParam(event, 'id')

  if (!factionId) {
    throw createError({
      statusCode: 400,
      message: 'Faction ID is required',
    })
  }

  interface DbRelation {
    id: number
    from_entity_id: number
    to_entity_id: number
    relation_type: string
    notes: string | null
    created_at: string
    related_faction_id: number
    related_faction_name: string
    related_faction_image_url: string | null
    direction: 'outgoing' | 'incoming'
  }

  // Get the Faction entity type ID
  const factionTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'Faction'").get() as
    | { id: number }
    | undefined

  if (!factionTypeId) {
    throw createError({
      statusCode: 500,
      message: 'Faction entity type not found',
    })
  }

  // Get bidirectional Faction-to-Faction relations
  // UNION: Relations where this Faction is 'from' (outgoing) OR 'to' (incoming)
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
      e.id as related_faction_id,
      e.name as related_faction_name,
      e.image_url as related_faction_image_url,
      'outgoing' as direction
    FROM entity_relations er
    INNER JOIN entities e ON er.to_entity_id = e.id
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
      e.id as related_faction_id,
      e.name as related_faction_name,
      e.image_url as related_faction_image_url,
      'incoming' as direction
    FROM entity_relations er
    INNER JOIN entities e ON er.from_entity_id = e.id
    WHERE er.to_entity_id = ?
      AND e.type_id = ?
      AND e.deleted_at IS NULL

    ORDER BY related_faction_name
  `,
    )
    .all(factionId, factionTypeId.id, factionId, factionTypeId.id)

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
      related_faction_id: rel.related_faction_id,
      related_faction_name: rel.related_faction_name,
      relation_type: rel.relation_type,
      notes: parsedNotes,
      image_url: rel.related_faction_image_url,
      direction: rel.direction,
    }
  })
})
