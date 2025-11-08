import { getDb } from '../../../utils/db'

export default defineEventHandler((event) => {
  const db = getDb()
  const loreId = getRouterParam(event, 'id')

  if (!loreId) {
    throw createError({
      statusCode: 400,
      message: 'Lore ID is required',
    })
  }

  // Get Item entity type ID
  const itemType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Item') as
    | { id: number }
    | undefined

  if (!itemType) {
    return []
  }

  interface ItemRow {
    id: number
    name: string
    description: string | null
    image_url: string | null
  }

  // Get all Items linked to this Lore entry (bidirectional)
  const items = db
    .prepare<unknown[], ItemRow>(
      `
    SELECT DISTINCT
      e.id,
      e.name,
      e.description,
      ei.image_url
    FROM entity_relations er
    INNER JOIN entities e ON e.id = er.from_entity_id
    LEFT JOIN (
      SELECT entity_id, image_url
      FROM entity_images
      WHERE is_primary = 1
    ) ei ON ei.entity_id = e.id
    WHERE er.to_entity_id = ?
      AND e.type_id = ?
      AND e.deleted_at IS NULL
    ORDER BY e.name ASC
  `,
    )
    .all(loreId, itemType.id)

  return items
})
