import { getDb } from '../../utils/db'

interface ItemCounts {
  owners: number
  locations: number
  lore: number
  factions: number
  players: number
  documents: number
  images: number
}

/**
 * GET /api/items/batch-counts
 * Returns counts for ALL items in a campaign in one request
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
    .prepare('SELECT id, name FROM entity_types WHERE name IN (\'Item\', \'NPC\', \'Location\', \'Lore\', \'Faction\', \'Player\')')
    .all() as Array<{ id: number; name: string }>

  const typeMap = Object.fromEntries(entityTypes.map((t) => [t.name, t.id]))
  const itemTypeId = typeMap['Item']
  const npcTypeId = typeMap['NPC']
  const locationTypeId = typeMap['Location']
  const loreTypeId = typeMap['Lore']
  const factionTypeId = typeMap['Faction']
  const playerTypeId = typeMap['Player']

  if (!itemTypeId) {
    return {}
  }

  // Get all Item IDs for this campaign
  const itemIds = db
    .prepare('SELECT id FROM entities WHERE campaign_id = ? AND type_id = ? AND deleted_at IS NULL')
    .all(Number(campaignId), itemTypeId) as Array<{ id: number }>

  if (itemIds.length === 0) {
    return {}
  }

  const result: Record<number, ItemCounts> = {}

  // Initialize all items with zero counts
  for (const item of itemIds) {
    result[item.id] = {
      owners: 0,
      locations: 0,
      lore: 0,
      factions: 0,
      players: 0,
      documents: 0,
      images: 0,
    }
  }

  // 1. Get owners count (NPCs that own items)
  if (npcTypeId) {
    const ownersCounts = db.prepare(`
      SELECT er.to_entity_id as item_id, COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities npc ON npc.id = er.from_entity_id
      INNER JOIN entities item ON item.id = er.to_entity_id
      WHERE item.campaign_id = ?
        AND item.type_id = ?
        AND item.deleted_at IS NULL
        AND npc.type_id = ?
        AND npc.deleted_at IS NULL
      GROUP BY er.to_entity_id
    `).all(Number(campaignId), itemTypeId, npcTypeId) as Array<{ item_id: number; count: number }>

    for (const row of ownersCounts) {
      if (result[row.item_id]) {
        result[row.item_id].owners = row.count
      }
    }
  }

  // 2. Get locations count
  if (locationTypeId) {
    const locationsCounts = db.prepare(`
      SELECT er.to_entity_id as item_id, COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities loc ON loc.id = er.from_entity_id
      INNER JOIN entities item ON item.id = er.to_entity_id
      WHERE item.campaign_id = ?
        AND item.type_id = ?
        AND item.deleted_at IS NULL
        AND loc.type_id = ?
        AND loc.deleted_at IS NULL
      GROUP BY er.to_entity_id
    `).all(Number(campaignId), itemTypeId, locationTypeId) as Array<{ item_id: number; count: number }>

    for (const row of locationsCounts) {
      if (result[row.item_id]) {
        result[row.item_id].locations = row.count
      }
    }
  }

  // 3. Get lore count
  if (loreTypeId) {
    const loreCounts = db.prepare(`
      SELECT er.from_entity_id as item_id, COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities lore ON lore.id = er.to_entity_id
      INNER JOIN entities item ON item.id = er.from_entity_id
      WHERE item.campaign_id = ?
        AND item.type_id = ?
        AND item.deleted_at IS NULL
        AND lore.type_id = ?
        AND lore.deleted_at IS NULL
      GROUP BY er.from_entity_id
    `).all(Number(campaignId), itemTypeId, loreTypeId) as Array<{ item_id: number; count: number }>

    for (const row of loreCounts) {
      if (result[row.item_id]) {
        result[row.item_id].lore = row.count
      }
    }
  }

  // 4. Get factions count (bidirectional)
  if (factionTypeId) {
    const factionsCounts = db.prepare(`
      SELECT item_id, COUNT(DISTINCT faction_id) as count FROM (
        SELECT er.from_entity_id as item_id, e.id as faction_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        INNER JOIN entities item ON item.id = er.from_entity_id
        WHERE item.campaign_id = ?
          AND item.type_id = ?
          AND item.deleted_at IS NULL
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT er.to_entity_id as item_id, e.id as faction_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        INNER JOIN entities item ON item.id = er.to_entity_id
        WHERE item.campaign_id = ?
          AND item.type_id = ?
          AND item.deleted_at IS NULL
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      )
      GROUP BY item_id
    `).all(
      Number(campaignId), itemTypeId, factionTypeId,
      Number(campaignId), itemTypeId, factionTypeId,
    ) as Array<{ item_id: number; count: number }>

    for (const row of factionsCounts) {
      if (result[row.item_id]) {
        result[row.item_id].factions = row.count
      }
    }
  }

  // 5. Get players count (bidirectional)
  if (playerTypeId) {
    const playersCounts = db.prepare(`
      SELECT item_id, COUNT(DISTINCT player_id) as count FROM (
        SELECT er.from_entity_id as item_id, e.id as player_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        INNER JOIN entities item ON item.id = er.from_entity_id
        WHERE item.campaign_id = ?
          AND item.type_id = ?
          AND item.deleted_at IS NULL
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT er.to_entity_id as item_id, e.id as player_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        INNER JOIN entities item ON item.id = er.to_entity_id
        WHERE item.campaign_id = ?
          AND item.type_id = ?
          AND item.deleted_at IS NULL
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      )
      GROUP BY item_id
    `).all(
      Number(campaignId), itemTypeId, playerTypeId,
      Number(campaignId), itemTypeId, playerTypeId,
    ) as Array<{ item_id: number; count: number }>

    for (const row of playersCounts) {
      if (result[row.item_id]) {
        result[row.item_id].players = row.count
      }
    }
  }

  // 6. Get documents count
  const documentsCounts = db.prepare(`
    SELECT ed.entity_id as item_id, COUNT(*) as count
    FROM entity_documents ed
    INNER JOIN entities item ON item.id = ed.entity_id
    WHERE item.campaign_id = ?
      AND item.type_id = ?
      AND item.deleted_at IS NULL
    GROUP BY ed.entity_id
  `).all(Number(campaignId), itemTypeId) as Array<{ item_id: number; count: number }>

  for (const row of documentsCounts) {
    if (result[row.item_id]) {
      result[row.item_id].documents = row.count
    }
  }

  // 7. Get images count
  const imagesCounts = db.prepare(`
    SELECT ei.entity_id as item_id, COUNT(*) as count
    FROM entity_images ei
    INNER JOIN entities item ON item.id = ei.entity_id
    WHERE item.campaign_id = ?
      AND item.type_id = ?
      AND item.deleted_at IS NULL
    GROUP BY ei.entity_id
  `).all(Number(campaignId), itemTypeId) as Array<{ item_id: number; count: number }>

  for (const row of imagesCounts) {
    if (result[row.item_id]) {
      result[row.item_id].images = row.count
    }
  }

  return result
})
