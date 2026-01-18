import { getDb } from '../../utils/db'

interface GroupInfo {
  id: number
  name: string
  color: string | null
  icon: string | null
}

interface FactionCounts {
  members: number
  items: number
  locations: number
  lore: number
  players: number
  documents: number
  images: number
  relations: number
  groups: GroupInfo[]
}

/**
 * GET /api/factions/batch-counts
 * Returns counts for ALL factions in a campaign in one request
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
    .prepare('SELECT id, name FROM entity_types WHERE name IN (\'Faction\', \'NPC\', \'Item\', \'Location\', \'Lore\', \'Player\')')
    .all() as Array<{ id: number; name: string }>

  const typeMap = Object.fromEntries(entityTypes.map((t) => [t.name, t.id]))
  const factionTypeId = typeMap['Faction']
  const npcTypeId = typeMap['NPC']
  const itemTypeId = typeMap['Item']
  const locationTypeId = typeMap['Location']
  const loreTypeId = typeMap['Lore']
  const playerTypeId = typeMap['Player']

  if (!factionTypeId) {
    return {}
  }

  // Get all Faction IDs for this campaign
  const factionIds = db
    .prepare('SELECT id FROM entities WHERE campaign_id = ? AND type_id = ? AND deleted_at IS NULL')
    .all(Number(campaignId), factionTypeId) as Array<{ id: number }>

  if (factionIds.length === 0) {
    return {}
  }

  const result: Record<number, FactionCounts> = {}

  // Initialize all factions with zero counts
  for (const faction of factionIds) {
    result[faction.id] = {
      members: 0,
      items: 0,
      locations: 0,
      lore: 0,
      players: 0,
      documents: 0,
      images: 0,
      relations: 0,
      groups: [],
    }
  }

  // 1. Get members count (NPCs that belong to factions)
  if (npcTypeId) {
    const membersCounts = db.prepare(`
      SELECT er.to_entity_id as faction_id, COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities npc ON npc.id = er.from_entity_id
      INNER JOIN entities faction ON faction.id = er.to_entity_id
      WHERE faction.campaign_id = ?
        AND faction.type_id = ?
        AND faction.deleted_at IS NULL
        AND npc.type_id = ?
        AND npc.deleted_at IS NULL
      GROUP BY er.to_entity_id
    `).all(Number(campaignId), factionTypeId, npcTypeId) as Array<{ faction_id: number; count: number }>

    for (const row of membersCounts) {
      if (result[row.faction_id]) {
        result[row.faction_id].members = row.count
      }
    }
  }

  // 2. Get items count (bidirectional)
  if (itemTypeId) {
    const itemsCounts = db.prepare(`
      SELECT faction_id, COUNT(DISTINCT item_id) as count FROM (
        SELECT er.from_entity_id as faction_id, e.id as item_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        INNER JOIN entities faction ON faction.id = er.from_entity_id
        WHERE faction.campaign_id = ?
          AND faction.type_id = ?
          AND faction.deleted_at IS NULL
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT er.to_entity_id as faction_id, e.id as item_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        INNER JOIN entities faction ON faction.id = er.to_entity_id
        WHERE faction.campaign_id = ?
          AND faction.type_id = ?
          AND faction.deleted_at IS NULL
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      )
      GROUP BY faction_id
    `).all(
      Number(campaignId), factionTypeId, itemTypeId,
      Number(campaignId), factionTypeId, itemTypeId,
    ) as Array<{ faction_id: number; count: number }>

    for (const row of itemsCounts) {
      if (result[row.faction_id]) {
        result[row.faction_id].items = row.count
      }
    }
  }

  // 3. Get locations count (bidirectional)
  if (locationTypeId) {
    const locationsCounts = db.prepare(`
      SELECT faction_id, COUNT(DISTINCT location_id) as count FROM (
        SELECT er.from_entity_id as faction_id, e.id as location_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        INNER JOIN entities faction ON faction.id = er.from_entity_id
        WHERE faction.campaign_id = ?
          AND faction.type_id = ?
          AND faction.deleted_at IS NULL
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT er.to_entity_id as faction_id, e.id as location_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        INNER JOIN entities faction ON faction.id = er.to_entity_id
        WHERE faction.campaign_id = ?
          AND faction.type_id = ?
          AND faction.deleted_at IS NULL
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      )
      GROUP BY faction_id
    `).all(
      Number(campaignId), factionTypeId, locationTypeId,
      Number(campaignId), factionTypeId, locationTypeId,
    ) as Array<{ faction_id: number; count: number }>

    for (const row of locationsCounts) {
      if (result[row.faction_id]) {
        result[row.faction_id].locations = row.count
      }
    }
  }

  // 4. Get lore count
  if (loreTypeId) {
    const loreCounts = db.prepare(`
      SELECT er.to_entity_id as faction_id, COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities lore ON lore.id = er.from_entity_id
      INNER JOIN entities faction ON faction.id = er.to_entity_id
      WHERE faction.campaign_id = ?
        AND faction.type_id = ?
        AND faction.deleted_at IS NULL
        AND lore.type_id = ?
        AND lore.deleted_at IS NULL
      GROUP BY er.to_entity_id
    `).all(Number(campaignId), factionTypeId, loreTypeId) as Array<{ faction_id: number; count: number }>

    for (const row of loreCounts) {
      if (result[row.faction_id]) {
        result[row.faction_id].lore = row.count
      }
    }
  }

  // 5. Get players count (bidirectional)
  if (playerTypeId) {
    const playersCounts = db.prepare(`
      SELECT faction_id, COUNT(DISTINCT player_id) as count FROM (
        SELECT er.from_entity_id as faction_id, e.id as player_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        INNER JOIN entities faction ON faction.id = er.from_entity_id
        WHERE faction.campaign_id = ?
          AND faction.type_id = ?
          AND faction.deleted_at IS NULL
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT er.to_entity_id as faction_id, e.id as player_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        INNER JOIN entities faction ON faction.id = er.to_entity_id
        WHERE faction.campaign_id = ?
          AND faction.type_id = ?
          AND faction.deleted_at IS NULL
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      )
      GROUP BY faction_id
    `).all(
      Number(campaignId), factionTypeId, playerTypeId,
      Number(campaignId), factionTypeId, playerTypeId,
    ) as Array<{ faction_id: number; count: number }>

    for (const row of playersCounts) {
      if (result[row.faction_id]) {
        result[row.faction_id].players = row.count
      }
    }
  }

  // 6. Get faction-to-faction relations count (bidirectional)
  const relationsCounts = db.prepare(`
    SELECT faction_id, COUNT(DISTINCT related_id) as count FROM (
      SELECT er.from_entity_id as faction_id, e.id as related_id
      FROM entity_relations er
      INNER JOIN entities e ON e.id = er.to_entity_id
      INNER JOIN entities faction ON faction.id = er.from_entity_id
      WHERE faction.campaign_id = ?
        AND faction.type_id = ?
        AND faction.deleted_at IS NULL
        AND e.type_id = ?
        AND e.deleted_at IS NULL

      UNION ALL

      SELECT er.to_entity_id as faction_id, e.id as related_id
      FROM entity_relations er
      INNER JOIN entities e ON e.id = er.from_entity_id
      INNER JOIN entities faction ON faction.id = er.to_entity_id
      WHERE faction.campaign_id = ?
        AND faction.type_id = ?
        AND faction.deleted_at IS NULL
        AND e.type_id = ?
        AND e.deleted_at IS NULL
    )
    GROUP BY faction_id
  `).all(
    Number(campaignId), factionTypeId, factionTypeId,
    Number(campaignId), factionTypeId, factionTypeId,
  ) as Array<{ faction_id: number; count: number }>

  for (const row of relationsCounts) {
    if (result[row.faction_id]) {
      result[row.faction_id].relations = row.count
    }
  }

  // 7. Get documents count
  const documentsCounts = db.prepare(`
    SELECT ed.entity_id as faction_id, COUNT(*) as count
    FROM entity_documents ed
    INNER JOIN entities faction ON faction.id = ed.entity_id
    WHERE faction.campaign_id = ?
      AND faction.type_id = ?
      AND faction.deleted_at IS NULL
    GROUP BY ed.entity_id
  `).all(Number(campaignId), factionTypeId) as Array<{ faction_id: number; count: number }>

  for (const row of documentsCounts) {
    if (result[row.faction_id]) {
      result[row.faction_id].documents = row.count
    }
  }

  // 8. Get images count
  const imagesCounts = db.prepare(`
    SELECT ei.entity_id as faction_id, COUNT(*) as count
    FROM entity_images ei
    INNER JOIN entities faction ON faction.id = ei.entity_id
    WHERE faction.campaign_id = ?
      AND faction.type_id = ?
      AND faction.deleted_at IS NULL
    GROUP BY ei.entity_id
  `).all(Number(campaignId), factionTypeId) as Array<{ faction_id: number; count: number }>

  for (const row of imagesCounts) {
    if (result[row.faction_id]) {
      result[row.faction_id].images = row.count
    }
  }

  // 9. Groups - fetch all group memberships for factions in this campaign
  const groupMemberships = db.prepare(`
    SELECT
      gm.entity_id as faction_id,
      g.id as group_id,
      g.name as group_name,
      g.color,
      g.icon
    FROM entity_group_members gm
    INNER JOIN entity_groups g ON g.id = gm.group_id AND g.deleted_at IS NULL
    INNER JOIN entities faction ON faction.id = gm.entity_id
    WHERE faction.campaign_id = ?
      AND faction.type_id = ?
      AND faction.deleted_at IS NULL
    ORDER BY g.name
  `).all(Number(campaignId), factionTypeId) as Array<{
    faction_id: number
    group_id: number
    group_name: string
    color: string | null
    icon: string | null
  }>

  for (const row of groupMemberships) {
    if (result[row.faction_id]) {
      result[row.faction_id].groups.push({
        id: row.group_id,
        name: row.group_name,
        color: row.color,
        icon: row.icon,
      })
    }
  }

  return result
})
