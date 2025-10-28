import { getDb } from '../../../utils/db'

interface DbLocation {
  id: number
  from_entity_id: number
  to_entity_id: number
  relation_type: string
  notes: string | null
  created_at: string
  location_name: string
}

export default defineEventHandler(async (event) => {
  const db = getDb()
  const itemId = getRouterParam(event, 'id')

  if (!itemId) {
    throw createError({
      statusCode: 400,
      message: 'Item ID is required',
    })
  }

  // Get all Locations that have a relation TO this item
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
    INNER JOIN entities e ON er.from_entity_id = e.id
    INNER JOIN entity_types et ON e.type_id = et.id
    WHERE er.to_entity_id = ?
      AND et.name = 'Location'
      AND e.deleted_at IS NULL
    ORDER BY e.name ASC
  `).all(itemId)

  return locations.map(location => ({
    ...location,
    notes: location.notes ? JSON.parse(location.notes) : null,
  }))
})
