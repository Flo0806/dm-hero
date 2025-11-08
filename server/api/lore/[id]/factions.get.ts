import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const loreId = getRouterParam(event, 'id')

  if (!loreId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Lore ID is required',
    })
  }

  try {
    const linkedFactions = db
      .prepare(`
        SELECT
          faction.id,
          faction.name,
          faction.description,
          faction.image_url
        FROM entity_relations er
        INNER JOIN entities faction ON faction.id = er.to_entity_id
        INNER JOIN entity_types ft ON ft.id = faction.type_id
        WHERE er.from_entity_id = ?
          AND ft.name = 'Faction'
          AND faction.deleted_at IS NULL
        ORDER BY faction.name ASC
      `)
      .all(loreId)

    return linkedFactions
  } catch (error) {
    console.error('Error fetching linked Factions:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch linked Factions',
    })
  }
})
