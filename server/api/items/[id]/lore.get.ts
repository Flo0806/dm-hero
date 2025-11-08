import { getDb } from '../../../utils/db'

export default defineEventHandler((event) => {
  const db = getDb()
  const itemId = getRouterParam(event, 'id')

  if (!itemId) {
    throw createError({
      statusCode: 400,
      message: 'Item ID is required',
    })
  }

  // Get Lore entity type ID
  const loreType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Lore') as
    | { id: number }
    | undefined

  if (!loreType) {
    return []
  }

  interface LoreRow {
    id: number
    name: string
    description: string | null
    image_url: string | null
  }

  // Get all lore entries linked to this Item
  const loreEntries = db
    .prepare<unknown[], LoreRow>(
      `
    SELECT DISTINCT
      e.id,
      e.name,
      e.description,
      ei.image_url
    FROM entity_relations er
    INNER JOIN entities e ON e.id = er.to_entity_id
    LEFT JOIN (
      SELECT entity_id, image_url
      FROM entity_images
      WHERE is_primary = 1
    ) ei ON ei.entity_id = e.id
    WHERE er.from_entity_id = ?
      AND e.type_id = ?
      AND e.deleted_at IS NULL
    ORDER BY e.name ASC
  `,
    )
    .all(itemId, loreType.id)

  return loreEntries
})
