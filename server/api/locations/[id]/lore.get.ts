import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const locationId = getRouterParam(event, 'id')

  if (!locationId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Location ID is required',
    })
  }

  try {
    // Get Lore linked to this Location via entity_relations
    // Relations: from_entity_id (Lore) -> to_entity_id (Location)
    const linkedLore = db
      .prepare(
        `
      SELECT
        lore.id,
        lore.name,
        lore.description,
        lore.image_url
      FROM entity_relations er
      INNER JOIN entities lore ON lore.id = er.from_entity_id
      INNER JOIN entity_types lt ON lt.id = lore.type_id
      WHERE er.to_entity_id = ?
        AND lt.name = 'Lore'
        AND lore.deleted_at IS NULL
      ORDER BY lore.name ASC
    `,
      )
      .all(locationId)

    return linkedLore
  } catch (error) {
    console.error('Error fetching linked Lore:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch linked Lore',
    })
  }
})
