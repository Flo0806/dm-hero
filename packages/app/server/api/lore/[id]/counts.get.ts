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
    // Count bidirectional: NPCs where Lore is 'to' OR 'from'
    const npcsResult = db
      .prepare(
        `
      SELECT COUNT(DISTINCT e.id) as count
      FROM (
        SELECT e.id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION

        SELECT e.id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      ) AS e
    `,
      )
      .get(Number(loreId), npcTypeId.id, Number(loreId), npcTypeId.id) as { count: number }
    npcsCount = npcsResult.count
  }

  // Get Item type ID
  const itemTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'Item'").get() as
    | { id: number }
    | undefined

  let itemsCount = 0
  if (itemTypeId) {
    // Count bidirectional: Items where Lore is 'to' OR 'from'
    const itemsResult = db
      .prepare(
        `
      SELECT COUNT(DISTINCT e.id) as count
      FROM (
        SELECT e.id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION

        SELECT e.id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      ) AS e
    `,
      )
      .get(Number(loreId), itemTypeId.id, Number(loreId), itemTypeId.id) as { count: number }
    itemsCount = itemsResult.count
  }

  // Get Faction type ID
  const factionTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'Faction'").get() as
    | { id: number }
    | undefined

  let factionsCount = 0
  if (factionTypeId) {
    // Count bidirectional: Factions where Lore is 'to' OR 'from'
    const factionsResult = db
      .prepare(
        `
      SELECT COUNT(DISTINCT e.id) as count
      FROM (
        SELECT e.id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION

        SELECT e.id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      ) AS e
    `,
      )
      .get(Number(loreId), factionTypeId.id, Number(loreId), factionTypeId.id) as { count: number }
    factionsCount = factionsResult.count
  }

  // Get Location type ID
  const locationTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'Location'").get() as
    | { id: number }
    | undefined

  let locationsCount = 0
  if (locationTypeId) {
    // Count bidirectional: Locations where Lore is 'to' OR 'from'
    const locationsResult = db
      .prepare(
        `
      SELECT COUNT(DISTINCT e.id) as count
      FROM (
        SELECT e.id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION

        SELECT e.id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      ) AS e
    `,
      )
      .get(Number(loreId), locationTypeId.id, Number(loreId), locationTypeId.id) as { count: number }
    locationsCount = locationsResult.count
  }

  // Get Player type ID
  const playerTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'Player'").get() as
    | { id: number }
    | undefined

  let playersCount = 0
  if (playerTypeId) {
    // Count bidirectional: Players where Lore is 'to' OR 'from'
    const playersResult = db
      .prepare(
        `
      SELECT COUNT(DISTINCT e.id) as count
      FROM (
        SELECT e.id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION

        SELECT e.id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      ) AS e
    `,
      )
      .get(Number(loreId), playerTypeId.id, Number(loreId), playerTypeId.id) as { count: number }
    playersCount = playersResult.count
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
    locations: locationsCount,
    players: playersCount,
    documents: documentsCount.count,
    images: imagesCount.count,
  }
})
