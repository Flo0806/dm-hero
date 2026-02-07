import { getDb } from '../../../utils/db'

/**
 * GET /api/locations/:id/counts
 * Returns counts for NPCs and Lore linked to a location
 */
export default defineEventHandler((event) => {
  const db = getDb()
  const locationId = getRouterParam(event, 'id')

  if (!locationId) {
    throw createError({
      statusCode: 400,
      message: 'Location ID is required',
    })
  }

  // Get NPCs count (bidirectional - NPCs linked to/from this location)
  const npcTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'NPC'").get() as
    | { id: number }
    | undefined

  let npcsCount = 0
  if (npcTypeId) {
    const npcsResult = db
      .prepare(
        `
      SELECT COUNT(DISTINCT e.id) as count
      FROM (
        SELECT e.id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION

        SELECT e.id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      ) AS e
    `,
      )
      .get(Number(locationId), npcTypeId.id, Number(locationId), npcTypeId.id) as { count: number }
    npcsCount = npcsResult.count
  }

  // Get Lore count (bidirectional - Lore linked to/from this location)
  const loreTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'Lore'").get() as
    | { id: number }
    | undefined

  let loreCount = 0
  if (loreTypeId) {
    const loreResult = db
      .prepare(
        `
      SELECT COUNT(DISTINCT e.id) as count
      FROM (
        SELECT e.id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION

        SELECT e.id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      ) AS e
    `,
      )
      .get(Number(locationId), loreTypeId.id, Number(locationId), loreTypeId.id) as { count: number }
    loreCount = loreResult.count
  }

  // Get items count (bidirectional - Items linked to/from this location)
  const itemTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'Item'").get() as
    | { id: number }
    | undefined

  let itemsCount = 0
  if (itemTypeId) {
    const itemsResult = db
      .prepare(
        `
      SELECT COUNT(DISTINCT e.id) as count
      FROM (
        SELECT e.id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION

        SELECT e.id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      ) AS e
    `,
      )
      .get(Number(locationId), itemTypeId.id, Number(locationId), itemTypeId.id) as { count: number }
    itemsCount = itemsResult.count
  }

  // Get documents count
  const documentsCount = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM entity_documents
    WHERE entity_id = ?
      AND (document_type IS NULL OR document_type != 'character_sheet')
  `,
    )
    .get(Number(locationId)) as { count: number }

  // Get images count
  const imagesCount = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM entity_images
    WHERE entity_id = ?
  `,
    )
    .get(Number(locationId)) as { count: number }

  // Get players count (bidirectional)
  const playerTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'Player'").get() as
    | { id: number }
    | undefined

  let playersCount = 0
  if (playerTypeId) {
    const playersResult = db
      .prepare(
        `
      SELECT COUNT(DISTINCT e.id) as count
      FROM (
        SELECT e.id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION

        SELECT e.id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      ) AS e
    `,
      )
      .get(Number(locationId), playerTypeId.id, Number(locationId), playerTypeId.id) as { count: number }
    playersCount = playersResult.count
  }

  // Get factions count (bidirectional)
  const factionTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'Faction'").get() as
    | { id: number }
    | undefined

  let factionsCount = 0
  if (factionTypeId) {
    const factionsResult = db
      .prepare(
        `
      SELECT COUNT(DISTINCT e.id) as count
      FROM (
        SELECT e.id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION

        SELECT e.id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      ) AS e
    `,
      )
      .get(Number(locationId), factionTypeId.id, Number(locationId), factionTypeId.id) as { count: number }
    factionsCount = factionsResult.count
  }

  return {
    npcs: npcsCount,
    items: itemsCount,
    lore: loreCount,
    players: playersCount,
    factions: factionsCount,
    documents: documentsCount.count,
    images: imagesCount.count,
  }
})
