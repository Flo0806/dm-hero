import { getDb } from '../../../utils/db'

/**
 * GET /api/items/:id/counts
 * Returns counts for owners, locations, lore, documents, and images for an Item
 */
export default defineEventHandler((event) => {
  const db = getDb()
  const itemId = getRouterParam(event, 'id')

  if (!itemId) {
    throw createError({
      statusCode: 400,
      message: 'Item ID is required',
    })
  }

  // Get NPCs count (owners of this item)
  const npcTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'NPC'").get() as
    | { id: number }
    | undefined

  let ownersCount = 0
  if (npcTypeId) {
    const ownersResult = db
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
      .get(Number(itemId), npcTypeId.id) as { count: number }
    ownersCount = ownersResult.count
  }

  // Get locations count
  const locationTypeId = db
    .prepare("SELECT id FROM entity_types WHERE name = 'Location'")
    .get() as { id: number } | undefined

  let locationsCount = 0
  if (locationTypeId) {
    const locationsResult = db
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
      .get(Number(itemId), locationTypeId.id) as { count: number }
    locationsCount = locationsResult.count
  }

  // Get lore count (Lore entries related to this item)
  const loreTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'Lore'").get() as
    | { id: number }
    | undefined

  let loreCount = 0
  if (loreTypeId) {
    const loreResult = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities e ON e.id = er.to_entity_id
      WHERE er.from_entity_id = ?
        AND e.type_id = ?
        AND e.deleted_at IS NULL
    `,
      )
      .get(Number(itemId), loreTypeId.id) as { count: number }
    loreCount = loreResult.count
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
    .get(Number(itemId)) as { count: number }

  // Get images count
  const imagesCount = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM entity_images
    WHERE entity_id = ?
  `,
    )
    .get(Number(itemId)) as { count: number }

  // Get factions count (bidirectional - Factions linked to/from this item)
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
      .get(Number(itemId), factionTypeId.id, Number(itemId), factionTypeId.id) as { count: number }
    factionsCount = factionsResult.count
  }

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
      .get(Number(itemId), playerTypeId.id, Number(itemId), playerTypeId.id) as { count: number }
    playersCount = playersResult.count
  }

  return {
    owners: ownersCount,
    locations: locationsCount,
    lore: loreCount,
    factions: factionsCount,
    players: playersCount,
    documents: documentsCount.count,
    images: imagesCount.count,
  }
})
