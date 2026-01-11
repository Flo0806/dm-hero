import { getDb } from '../../utils/db'

interface LoreCounts {
  npcs: number
  items: number
  factions: number
  locations: number
  players: number
  documents: number
  images: number
}

/**
 * GET /api/lore/batch-counts
 * Returns counts for ALL lore entries in a campaign in one request
 */
export default defineEventHandler((event) => {
  const db = getDb()
  const query = getQuery(event)
  const campaignId = query.campaignId

  if (!campaignId) {
    throw createError({
      statusCode: 400,
      message: 'campaignId is required',
    })
  }

  // Get all entity type IDs once
  const entityTypes = db
    .prepare('SELECT id, name FROM entity_types WHERE name IN (\'Lore\', \'NPC\', \'Item\', \'Faction\', \'Location\', \'Player\')')
    .all() as Array<{ id: number; name: string }>

  const typeMap = Object.fromEntries(entityTypes.map((t) => [t.name, t.id]))
  const loreTypeId = typeMap['Lore']
  const npcTypeId = typeMap['NPC']
  const itemTypeId = typeMap['Item']
  const factionTypeId = typeMap['Faction']
  const locationTypeId = typeMap['Location']
  const playerTypeId = typeMap['Player']

  if (!loreTypeId) {
    return {}
  }

  // Get all Lore IDs for this campaign
  const loreIds = db
    .prepare('SELECT id FROM entities WHERE campaign_id = ? AND type_id = ? AND deleted_at IS NULL')
    .all(Number(campaignId), loreTypeId) as Array<{ id: number }>

  if (loreIds.length === 0) {
    return {}
  }

  const result: Record<number, LoreCounts> = {}

  // Initialize all lore entries with zero counts
  for (const lore of loreIds) {
    result[lore.id] = {
      npcs: 0,
      items: 0,
      factions: 0,
      locations: 0,
      players: 0,
      documents: 0,
      images: 0,
    }
  }

  // 1. Get NPCs count (bidirectional)
  if (npcTypeId) {
    const npcsCounts = db.prepare(`
      SELECT lore_id, COUNT(DISTINCT npc_id) as count FROM (
        SELECT er.to_entity_id as lore_id, e.id as npc_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        INNER JOIN entities lore ON lore.id = er.to_entity_id
        WHERE lore.campaign_id = ?
          AND lore.type_id = ?
          AND lore.deleted_at IS NULL
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT er.from_entity_id as lore_id, e.id as npc_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        INNER JOIN entities lore ON lore.id = er.from_entity_id
        WHERE lore.campaign_id = ?
          AND lore.type_id = ?
          AND lore.deleted_at IS NULL
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      )
      GROUP BY lore_id
    `).all(
      Number(campaignId), loreTypeId, npcTypeId,
      Number(campaignId), loreTypeId, npcTypeId,
    ) as Array<{ lore_id: number; count: number }>

    for (const row of npcsCounts) {
      if (result[row.lore_id]) {
        result[row.lore_id].npcs = row.count
      }
    }
  }

  // 2. Get Items count (bidirectional)
  if (itemTypeId) {
    const itemsCounts = db.prepare(`
      SELECT lore_id, COUNT(DISTINCT item_id) as count FROM (
        SELECT er.to_entity_id as lore_id, e.id as item_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        INNER JOIN entities lore ON lore.id = er.to_entity_id
        WHERE lore.campaign_id = ?
          AND lore.type_id = ?
          AND lore.deleted_at IS NULL
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT er.from_entity_id as lore_id, e.id as item_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        INNER JOIN entities lore ON lore.id = er.from_entity_id
        WHERE lore.campaign_id = ?
          AND lore.type_id = ?
          AND lore.deleted_at IS NULL
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      )
      GROUP BY lore_id
    `).all(
      Number(campaignId), loreTypeId, itemTypeId,
      Number(campaignId), loreTypeId, itemTypeId,
    ) as Array<{ lore_id: number; count: number }>

    for (const row of itemsCounts) {
      if (result[row.lore_id]) {
        result[row.lore_id].items = row.count
      }
    }
  }

  // 3. Get Factions count (bidirectional)
  if (factionTypeId) {
    const factionsCounts = db.prepare(`
      SELECT lore_id, COUNT(DISTINCT faction_id) as count FROM (
        SELECT er.to_entity_id as lore_id, e.id as faction_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        INNER JOIN entities lore ON lore.id = er.to_entity_id
        WHERE lore.campaign_id = ?
          AND lore.type_id = ?
          AND lore.deleted_at IS NULL
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT er.from_entity_id as lore_id, e.id as faction_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        INNER JOIN entities lore ON lore.id = er.from_entity_id
        WHERE lore.campaign_id = ?
          AND lore.type_id = ?
          AND lore.deleted_at IS NULL
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      )
      GROUP BY lore_id
    `).all(
      Number(campaignId), loreTypeId, factionTypeId,
      Number(campaignId), loreTypeId, factionTypeId,
    ) as Array<{ lore_id: number; count: number }>

    for (const row of factionsCounts) {
      if (result[row.lore_id]) {
        result[row.lore_id].factions = row.count
      }
    }
  }

  // 4. Get Locations count (bidirectional)
  if (locationTypeId) {
    const locationsCounts = db.prepare(`
      SELECT lore_id, COUNT(DISTINCT location_id) as count FROM (
        SELECT er.to_entity_id as lore_id, e.id as location_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        INNER JOIN entities lore ON lore.id = er.to_entity_id
        WHERE lore.campaign_id = ?
          AND lore.type_id = ?
          AND lore.deleted_at IS NULL
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT er.from_entity_id as lore_id, e.id as location_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        INNER JOIN entities lore ON lore.id = er.from_entity_id
        WHERE lore.campaign_id = ?
          AND lore.type_id = ?
          AND lore.deleted_at IS NULL
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      )
      GROUP BY lore_id
    `).all(
      Number(campaignId), loreTypeId, locationTypeId,
      Number(campaignId), loreTypeId, locationTypeId,
    ) as Array<{ lore_id: number; count: number }>

    for (const row of locationsCounts) {
      if (result[row.lore_id]) {
        result[row.lore_id].locations = row.count
      }
    }
  }

  // 5. Get Players count (bidirectional)
  if (playerTypeId) {
    const playersCounts = db.prepare(`
      SELECT lore_id, COUNT(DISTINCT player_id) as count FROM (
        SELECT er.to_entity_id as lore_id, e.id as player_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        INNER JOIN entities lore ON lore.id = er.to_entity_id
        WHERE lore.campaign_id = ?
          AND lore.type_id = ?
          AND lore.deleted_at IS NULL
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT er.from_entity_id as lore_id, e.id as player_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        INNER JOIN entities lore ON lore.id = er.from_entity_id
        WHERE lore.campaign_id = ?
          AND lore.type_id = ?
          AND lore.deleted_at IS NULL
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      )
      GROUP BY lore_id
    `).all(
      Number(campaignId), loreTypeId, playerTypeId,
      Number(campaignId), loreTypeId, playerTypeId,
    ) as Array<{ lore_id: number; count: number }>

    for (const row of playersCounts) {
      if (result[row.lore_id]) {
        result[row.lore_id].players = row.count
      }
    }
  }

  // 6. Get documents count
  const documentsCounts = db.prepare(`
    SELECT ed.entity_id as lore_id, COUNT(*) as count
    FROM entity_documents ed
    INNER JOIN entities lore ON lore.id = ed.entity_id
    WHERE lore.campaign_id = ?
      AND lore.type_id = ?
      AND lore.deleted_at IS NULL
    GROUP BY ed.entity_id
  `).all(Number(campaignId), loreTypeId) as Array<{ lore_id: number; count: number }>

  for (const row of documentsCounts) {
    if (result[row.lore_id]) {
      result[row.lore_id].documents = row.count
    }
  }

  // 7. Get images count
  const imagesCounts = db.prepare(`
    SELECT ei.entity_id as lore_id, COUNT(*) as count
    FROM entity_images ei
    INNER JOIN entities lore ON lore.id = ei.entity_id
    WHERE lore.campaign_id = ?
      AND lore.type_id = ?
      AND lore.deleted_at IS NULL
    GROUP BY ei.entity_id
  `).all(Number(campaignId), loreTypeId) as Array<{ lore_id: number; count: number }>

  for (const row of imagesCounts) {
    if (result[row.lore_id]) {
      result[row.lore_id].images = row.count
    }
  }

  return result
})
