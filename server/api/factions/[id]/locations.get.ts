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

  interface DbLocation {
    id: number
    from_entity_id: number
    to_entity_id: number
    relation_type: string
    notes: string | null
    created_at: string
    location_name: string
  }

  // Get all locations that have a relation FROM this faction
  const locations = db.prepare<unknown[], DbLocation>(`
    SELECT
      er.id,
      er.from_entity_id,
      er.to_entity_id,
      er.relation_type,
      er.notes,
      er.created_at,
      e.name as location_name
    FROM entity_relations er
    INNER JOIN entities e ON er.to_entity_id = e.id
    WHERE er.from_entity_id = ?
      AND e.deleted_at IS NULL
    ORDER BY e.name ASC
  `).all(factionId)

  return locations.map(location => ({
    ...location,
    notes: location.notes ? JSON.parse(location.notes) : null,
  }))
})
