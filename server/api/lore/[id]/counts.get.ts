import { getDb } from '../../../utils/db'

/**
 * GET /api/lore/:id/counts
 * Returns counts for NPCs, Items, Factions, documents, and images for a Lore entry
 */
export default defineEventHandler((event) => {
  const db = getDb()
  const loreId = getRouterParam(event, 'id')

  if (!loreId) {
    throw createError({
      statusCode: 400,
      message: 'Lore ID is required',
    })
  }

  // Get NPC type ID
  const npcTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'NPC'").get() as
    | { id: number }
    | undefined

  let npcsCount = 0
  if (npcTypeId) {
    const npcsResult = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities e ON e.id = er.from_entity_id
      WHERE er.to_entity_id = ?
        AND e.type_id = ?
        AND e.deleted_at IS NULL
    `,
      )
      .get(Number(loreId), npcTypeId.id) as { count: number }
    npcsCount = npcsResult.count
  }

  // Get Item type ID
  const itemTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'Item'").get() as
    | { id: number }
    | undefined

  let itemsCount = 0
  if (itemTypeId) {
    const itemsResult = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities e ON e.id = er.from_entity_id
      WHERE er.to_entity_id = ?
        AND e.type_id = ?
        AND e.deleted_at IS NULL
    `,
      )
      .get(Number(loreId), itemTypeId.id) as { count: number }
    itemsCount = itemsResult.count
  }

  // Get Faction type ID
  const factionTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'Faction'").get() as
    | { id: number }
    | undefined

  let factionsCount = 0
  if (factionTypeId) {
    const factionsResult = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities e ON e.id = er.from_entity_id
      WHERE er.to_entity_id = ?
        AND e.type_id = ?
        AND e.deleted_at IS NULL
    `,
      )
      .get(Number(loreId), factionTypeId.id) as { count: number }
    factionsCount = factionsResult.count
  }

  // Get documents count
  const documentsCount = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM entity_documents
    WHERE entity_id = ?
  `,
    )
    .get(Number(loreId)) as { count: number }

  // Get images count
  const imagesCount = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM entity_images
    WHERE entity_id = ?
  `,
    )
    .get(Number(loreId)) as { count: number }

  return {
    npcs: npcsCount,
    items: itemsCount,
    factions: factionsCount,
    documents: documentsCount.count,
    images: imagesCount.count,
  }
})
