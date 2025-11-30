import { getDb } from '../../../utils/db'

/**
 * GET /api/players/:id/counts
 * Returns counts for relations, documents, and images for a Player
 */
export default defineEventHandler((event) => {
  const db = getDb()
  const playerId = getRouterParam(event, 'id')

  if (!playerId) {
    throw createError({
      statusCode: 400,
      message: 'Player ID is required',
    })
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
    .get(Number(playerId)) as { count: number }

  // Get images count
  const imagesCount = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM entity_images
    WHERE entity_id = ?
  `,
    )
    .get(Number(playerId)) as { count: number }

  // Get NPCs count (characters this player plays)
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
      INNER JOIN entities e ON e.id = er.to_entity_id
      WHERE er.from_entity_id = ?
        AND e.type_id = ?
        AND e.deleted_at IS NULL
    `,
      )
      .get(Number(playerId), npcTypeId.id) as { count: number }
    npcsCount = npcsResult.count
  }

  // Get items count
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
      INNER JOIN entities e ON e.id = er.to_entity_id
      WHERE er.from_entity_id = ?
        AND e.type_id = ?
        AND e.deleted_at IS NULL
    `,
      )
      .get(Number(playerId), itemTypeId.id) as { count: number }
    itemsCount = itemsResult.count
  }

  // Get locations count
  const locationTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'Location'").get() as
    | { id: number }
    | undefined

  let locationsCount = 0
  if (locationTypeId) {
    const locationsResult = db
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
      .get(Number(playerId), locationTypeId.id) as { count: number }
    locationsCount = locationsResult.count
  }

  // Get factions count
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
      INNER JOIN entities e ON e.id = er.to_entity_id
      WHERE er.from_entity_id = ?
        AND e.type_id = ?
        AND e.deleted_at IS NULL
    `,
      )
      .get(Number(playerId), factionTypeId.id) as { count: number }
    factionsCount = factionsResult.count
  }

  // Get lore count
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
      .get(Number(playerId), loreTypeId.id) as { count: number }
    loreCount = loreResult.count
  }

  // Get sessions count (where this player was mentioned)
  const sessionsCount = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM sessions s
    INNER JOIN session_mentions sm ON s.id = sm.session_id
    WHERE sm.entity_id = ?
      AND s.deleted_at IS NULL
  `,
    )
    .get(Number(playerId)) as { count: number }

  return {
    characters: npcsCount,
    items: itemsCount,
    locations: locationsCount,
    factions: factionsCount,
    lore: loreCount,
    sessions: sessionsCount.count,
    documents: documentsCount.count,
    images: imagesCount.count,
  }
})
