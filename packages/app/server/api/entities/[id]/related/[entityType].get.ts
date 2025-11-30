import { getDb } from '../../../../utils/db'

/**
 * Generic endpoint to get related entities of a specific type
 *
 * Example usage:
 * - GET /api/entities/123/related/items - Get all items linked to entity 123
 * - GET /api/entities/456/related/lore - Get all lore linked to entity 456
 * - GET /api/entities/789/related/npcs - Get all NPCs linked to entity 789
 */

interface DbRelatedEntity {
  id: number
  from_entity_id: number
  to_entity_id: number
  relation_type: string
  notes: string | null
  created_at: string
  entity_name: string
  entity_description: string | null
  entity_metadata: string | null
  entity_image_url: string | null
  direction: 'outgoing' | 'incoming'
}

export default defineEventHandler(async (event) => {
  const db = getDb()
  const entityId = getRouterParam(event, 'id')
  const entityType = getRouterParam(event, 'entityType')

  if (!entityId) {
    throw createError({
      statusCode: 400,
      message: 'Entity ID is required',
    })
  }

  if (!entityType) {
    throw createError({
      statusCode: 400,
      message: 'Entity type is required',
    })
  }

  // Normalize entity type to title case (e.g., "items" -> "Item", "npcs" -> "NPC")
  const entityTypeMap: Record<string, string> = {
    items: 'Item',
    item: 'Item',
    npcs: 'NPC',
    npc: 'NPC',
    locations: 'Location',
    location: 'Location',
    factions: 'Faction',
    faction: 'Faction',
    lore: 'Lore',
    players: 'Player',
    player: 'Player',
  }

  const normalizedType = entityTypeMap[entityType.toLowerCase()]

  if (!normalizedType) {
    throw createError({
      statusCode: 400,
      message: `Invalid entity type: ${entityType}. Valid types: items, npcs, locations, factions, lore, players`,
    })
  }

  // Get the target entity type ID
  const targetType = db
    .prepare('SELECT id FROM entity_types WHERE name = ?')
    .get(normalizedType) as { id: number } | undefined

  if (!targetType) {
    throw createError({
      statusCode: 404,
      message: `Entity type '${normalizedType}' not found`,
    })
  }

  // Get related entities (bidirectional)
  // UNION: Entities where source is 'from' (outgoing) OR source is 'to' (incoming)
  const relatedEntities = db
    .prepare<unknown[], DbRelatedEntity>(
      `
    SELECT
      er.id,
      er.from_entity_id,
      er.to_entity_id,
      er.relation_type,
      er.notes,
      er.created_at,
      e.name as entity_name,
      e.description as entity_description,
      e.metadata as entity_metadata,
      e.image_url as entity_image_url,
      'outgoing' as direction
    FROM entity_relations er
    INNER JOIN entities e ON er.to_entity_id = e.id
    INNER JOIN entity_types et ON e.type_id = et.id
    WHERE er.from_entity_id = ?
      AND et.id = ?
      AND e.deleted_at IS NULL

    UNION ALL

    SELECT
      er.id,
      er.from_entity_id,
      er.to_entity_id,
      er.relation_type,
      er.notes,
      er.created_at,
      e.name as entity_name,
      e.description as entity_description,
      e.metadata as entity_metadata,
      e.image_url as entity_image_url,
      'incoming' as direction
    FROM entity_relations er
    INNER JOIN entities e ON er.from_entity_id = e.id
    INNER JOIN entity_types et ON e.type_id = et.id
    WHERE er.to_entity_id = ?
      AND et.id = ?
      AND e.deleted_at IS NULL

    ORDER BY entity_name ASC
  `,
    )
    .all(entityId, targetType.id, entityId, targetType.id)

  // Map to consistent response format
  return relatedEntities.map((entity) => {
    // Try to parse notes as JSON, fallback to plain text if it fails
    let parsedNotes = null
    if (entity.notes) {
      try {
        parsedNotes = JSON.parse(entity.notes)
      } catch {
        // If not valid JSON, keep as plain text string
        parsedNotes = entity.notes
      }
    }

    // Try to parse metadata as JSON
    let parsedMetadata = null
    if (entity.entity_metadata) {
      try {
        parsedMetadata = JSON.parse(entity.entity_metadata)
      } catch {
        // If not valid JSON, keep as null
        parsedMetadata = null
      }
    }

    return {
      id: entity.id, // Relation ID
      from_entity_id: entity.from_entity_id,
      to_entity_id: entity.to_entity_id,
      relation_type: entity.relation_type,
      notes: parsedNotes,
      created_at: entity.created_at,
      name: entity.entity_name,
      description: entity.entity_description,
      metadata: parsedMetadata,
      image_url: entity.entity_image_url,
      direction: entity.direction,
    }
  })
})
