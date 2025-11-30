import { getDb } from '../../../utils/db'

/**
 * GET /api/npcs/:id/counts
 * Returns counts for relations, documents, and images for an NPC
 * Also returns the primary faction name if the NPC is a member of one
 */
export default defineEventHandler((event) => {
  const db = getDb()
  const npcId = getRouterParam(event, 'id')

  if (!npcId) {
    throw createError({
      statusCode: 400,
      message: 'NPC ID is required',
    })
  }

  // Get NPC-to-NPC relations count (bidirectional - both directions)
  const npcTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'NPC'").get() as
    | { id: number }
    | undefined

  let relationsCount = { count: 0 }
  if (npcTypeId) {
    relationsCount = db
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
      .get(Number(npcId), npcTypeId.id, Number(npcId), npcTypeId.id) as { count: number }
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
    .get(Number(npcId)) as { count: number }

  // Get images count
  const imagesCount = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM entity_images
    WHERE entity_id = ?
  `,
    )
    .get(Number(npcId)) as { count: number }

  // Get items count (Items owned by this NPC)
  const itemTypeId = db
    .prepare("SELECT id FROM entity_types WHERE name = 'Item'")
    .get() as { id: number } | undefined

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
      .get(Number(npcId), itemTypeId.id) as { count: number }
    itemsCount = itemsResult.count
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
      INNER JOIN entities e ON e.id = er.to_entity_id
      WHERE er.from_entity_id = ?
        AND e.type_id = ?
        AND e.deleted_at IS NULL
    `,
      )
      .get(Number(npcId), locationTypeId.id) as { count: number }
    locationsCount = locationsResult.count
  }

  // Get factions count (memberships)
  const factionTypeId = db
    .prepare("SELECT id FROM entity_types WHERE name = 'Faction'")
    .get() as { id: number } | undefined

  let membershipsCount = 0
  let factionName: string | null = null
  if (factionTypeId) {
    const membershipsResult = db
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
      .get(Number(npcId), factionTypeId.id) as { count: number }
    membershipsCount = membershipsResult.count

    // Get primary faction (first faction membership found)
    const faction = db
      .prepare(
        `
      SELECT e.name
      FROM entity_relations er
      INNER JOIN entities e ON e.id = er.to_entity_id
      WHERE er.from_entity_id = ?
        AND e.type_id = ?
        AND e.deleted_at IS NULL
      LIMIT 1
    `,
      )
      .get(Number(npcId), factionTypeId.id) as { name: string } | undefined

    factionName = faction?.name || null
  }

  // Get lore count
  const loreTypeId = db
    .prepare("SELECT id FROM entity_types WHERE name = 'Lore'")
    .get() as { id: number } | undefined

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
      .get(Number(npcId), loreTypeId.id) as { count: number }
    loreCount = loreResult.count
  }

  // Get notes count (stored as sessions with session_mentions)
  const notesCount = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM sessions s
    INNER JOIN session_mentions sm ON s.id = sm.session_id
    WHERE sm.entity_id = ?
      AND s.deleted_at IS NULL
  `,
    )
    .get(Number(npcId)) as { count: number }

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
      .get(Number(npcId), playerTypeId.id, Number(npcId), playerTypeId.id) as { count: number }
    playersCount = playersResult.count
  }

  return {
    relations: relationsCount.count,
    items: itemsCount,
    locations: locationsCount,
    documents: documentsCount.count,
    images: imagesCount.count,
    memberships: membershipsCount,
    lore: loreCount,
    notes: notesCount.count,
    players: playersCount,
    factionName,
  }
})
