import { getDb } from '../../utils/db'
import type { ItemRarityRow, EntityTypeRow, CountRow } from '../../types/database'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Item rarity ID is required',
    })
  }

  // Check if rarity exists
  const itemRarity = db
    .prepare<[string], ItemRarityRow>(
      `
    SELECT * FROM item_rarities WHERE id = ? AND deleted_at IS NULL
  `,
    )
    .get(id)

  if (!itemRarity) {
    throw createError({
      statusCode: 404,
      message: 'Item rarity not found',
    })
  }

  // Check if rarity is in use by any Items
  const itemEntityType = db
    .prepare<[], EntityTypeRow>(
      `
    SELECT id FROM entity_types WHERE name = 'Item'
  `,
    )
    .get()

  const inUse = db
    .prepare<[number | undefined, string], CountRow>(
      `
    SELECT COUNT(*) as count FROM entities
    WHERE type_id = ? AND deleted_at IS NULL
    AND json_extract(metadata, '$.rarity') = ?
  `,
    )
    .get(itemEntityType?.id, itemRarity.name)

  if (inUse && inUse.count > 0) {
    throw createError({
      statusCode: 409,
      message: `Cannot delete item rarity '${itemRarity.name}' because it is used by ${inUse.count} item(s)`,
    })
  }

  // Soft-delete the rarity
  db.prepare(
    `
    UPDATE item_rarities
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
  ).run(id)

  return { success: true }
})
