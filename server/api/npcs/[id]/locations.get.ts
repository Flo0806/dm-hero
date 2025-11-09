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

  interface DbLocation {
    id: number
    from_entity_id: number
    to_entity_id: number
    relation_type: string
    notes: string | null
    created_at: string
    location_name: string
    location_description: string | null
    location_metadata: string | null
    location_image_url: string | null
  }

  // Get the Location entity type ID
  const locationTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'Location'").get() as
    | { id: number }
    | undefined

  if (!locationTypeId) {
    throw createError({
      statusCode: 500,
      message: 'Location entity type not found',
    })
  }

  // Get all Locations that this NPC has a relation TO
  const locations = db
    .prepare<unknown[], DbLocation>(
      `
    SELECT
      er.id,
      er.from_entity_id,
      er.to_entity_id,
      er.relation_type,
      er.notes,
      er.created_at,
      e.name as location_name,
      e.description as location_description,
      e.metadata as location_metadata,
      e.image_url as location_image_url
    FROM entity_relations er
    INNER JOIN entities e ON er.to_entity_id = e.id
    WHERE er.from_entity_id = ?
      AND e.type_id = ?
      AND e.deleted_at IS NULL
    ORDER BY e.name ASC
  `,
    )
    .all(npcId, locationTypeId.id)

  return locations.map((location) => {
    const metadata = location.location_metadata ? JSON.parse(location.location_metadata) : null

    // Parse notes safely - handle both JSON and plain text
    let parsedNotes = null
    if (location.notes) {
      try {
        parsedNotes = JSON.parse(location.notes)
      } catch {
        // If not valid JSON, treat as plain text
        parsedNotes = location.notes
      }
    }

    return {
      id: location.to_entity_id,
      relation_id: location.id, // Keep relation ID for editing/deleting
      name: location.location_name,
      description: location.location_description,
      relation_type: location.relation_type,
      notes: parsedNotes,
      image_url: location.location_image_url,
      type: metadata?.type || null,
      region: metadata?.region || null,
    }
  })
})
