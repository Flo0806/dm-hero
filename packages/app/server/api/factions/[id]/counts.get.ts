import { getDb } from '../../../utils/db'

/**
 * GET /api/factions/:id/counts
 * Returns counts for members (NPCs), lore, documents, and images for a Faction
 */
export default defineEventHandler((event) => {
  const db = getDb()
  const factionId = getRouterParam(event, 'id')

  if (!factionId) {
    throw createError({
      statusCode: 400,
      message: 'Faction ID is required',
    })
  }

  // Get NPCs count (members of this faction)
  const npcTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'NPC'").get() as
    | { id: number }
    | undefined

  let membersCount = 0
  if (npcTypeId) {
    const membersResult = db
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
      .get(Number(factionId), npcTypeId.id) as { count: number }
    membersCount = membersResult.count
  }

  // Get lore count (Lore entries related to this faction)
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
      INNER JOIN entities e ON e.id = er.from_entity_id
      WHERE er.to_entity_id = ?
        AND e.type_id = ?
        AND e.deleted_at IS NULL
    `,
      )
      .get(Number(factionId), loreTypeId.id) as { count: number }
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
    .get(Number(factionId)) as { count: number }

  // Get items count (bidirectional)
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
      .get(Number(factionId), itemTypeId.id, Number(factionId), itemTypeId.id) as { count: number }
    itemsCount = itemsResult.count
  }

  // Get locations count (bidirectional)
  const locationTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'Location'").get() as
    | { id: number }
    | undefined

  let locationsCount = 0
  if (locationTypeId) {
    const locationsResult = db
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
      .get(Number(factionId), locationTypeId.id, Number(factionId), locationTypeId.id) as {
        count: number
      }
    locationsCount = locationsResult.count
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
      .get(Number(factionId), playerTypeId.id, Number(factionId), playerTypeId.id) as {
        count: number
      }
    playersCount = playersResult.count
  }

  // Get images count
  const imagesCount = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM entity_images
    WHERE entity_id = ?
  `,
    )
    .get(Number(factionId)) as { count: number }

  return {
    members: membersCount,
    items: itemsCount,
    locations: locationsCount,
    lore: loreCount,
    players: playersCount,
    documents: documentsCount.count,
    images: imagesCount.count,
  }
})
