import { getDb } from '../../utils/db'

interface NpcCounts {
  relations: number
  items: number
  locations: number
  documents: number
  images: number
  memberships: number
  lore: number
  notes: number
  players: number
  factionName: string | null
}

/**
 * GET /api/npcs/batch-counts
 * Returns counts for ALL NPCs in a campaign in one request
 * Replaces N individual /api/npcs/:id/counts requests with 1 batch request
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
    .prepare('SELECT id, name FROM entity_types WHERE name IN (\'NPC\', \'Item\', \'Location\', \'Faction\', \'Lore\', \'Player\')')
    .all() as Array<{ id: number; name: string }>

  const typeMap = Object.fromEntries(entityTypes.map((t) => [t.name, t.id]))
  const npcTypeId = typeMap['NPC']
  const itemTypeId = typeMap['Item']
  const locationTypeId = typeMap['Location']
  const factionTypeId = typeMap['Faction']
  const loreTypeId = typeMap['Lore']
  const playerTypeId = typeMap['Player']

  if (!npcTypeId) {
    return {}
  }

  // Get all NPC IDs for this campaign
  const npcIds = db
    .prepare(
      'SELECT id FROM entities WHERE campaign_id = ? AND type_id = ? AND deleted_at IS NULL',
    )
    .all(Number(campaignId), npcTypeId) as Array<{ id: number }>

  if (npcIds.length === 0) {
    return {}
  }

  const result: Record<number, NpcCounts> = {}

  // Initialize all NPCs with zero counts
  for (const npc of npcIds) {
    result[npc.id] = {
      relations: 0,
      items: 0,
      locations: 0,
      documents: 0,
      images: 0,
      memberships: 0,
      lore: 0,
      notes: 0,
      players: 0,
      factionName: null,
    }
  }

  // 1. Get NPC-to-NPC relations count (bidirectional) for all NPCs at once
  const relationsQuery = db.prepare(`
    SELECT npc_id, COUNT(DISTINCT related_id) as count FROM (
      SELECT er.from_entity_id as npc_id, e.id as related_id
      FROM entity_relations er
      INNER JOIN entities e ON e.id = er.to_entity_id
      INNER JOIN entities npc ON npc.id = er.from_entity_id
      WHERE npc.campaign_id = ?
        AND npc.type_id = ?
        AND npc.deleted_at IS NULL
        AND e.type_id = ?
        AND e.deleted_at IS NULL

      UNION ALL

      SELECT er.to_entity_id as npc_id, e.id as related_id
      FROM entity_relations er
      INNER JOIN entities e ON e.id = er.from_entity_id
      INNER JOIN entities npc ON npc.id = er.to_entity_id
      WHERE npc.campaign_id = ?
        AND npc.type_id = ?
        AND npc.deleted_at IS NULL
        AND e.type_id = ?
        AND e.deleted_at IS NULL
    )
    GROUP BY npc_id
  `)
  const relationsCounts = relationsQuery.all(
    Number(campaignId), npcTypeId, npcTypeId,
    Number(campaignId), npcTypeId, npcTypeId,
  ) as Array<{ npc_id: number; count: number }>

  for (const row of relationsCounts) {
    if (result[row.npc_id]) {
      result[row.npc_id].relations = row.count
    }
  }

  // 2. Get items count for all NPCs
  if (itemTypeId) {
    const itemsCounts = db.prepare(`
      SELECT er.from_entity_id as npc_id, COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities item ON item.id = er.to_entity_id
      INNER JOIN entities npc ON npc.id = er.from_entity_id
      WHERE npc.campaign_id = ?
        AND npc.type_id = ?
        AND npc.deleted_at IS NULL
        AND item.type_id = ?
        AND item.deleted_at IS NULL
      GROUP BY er.from_entity_id
    `).all(Number(campaignId), npcTypeId, itemTypeId) as Array<{ npc_id: number; count: number }>

    for (const row of itemsCounts) {
      if (result[row.npc_id]) {
        result[row.npc_id].items = row.count
      }
    }
  }

  // 3. Get locations count for all NPCs
  if (locationTypeId) {
    const locationsCounts = db.prepare(`
      SELECT er.from_entity_id as npc_id, COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities loc ON loc.id = er.to_entity_id
      INNER JOIN entities npc ON npc.id = er.from_entity_id
      WHERE npc.campaign_id = ?
        AND npc.type_id = ?
        AND npc.deleted_at IS NULL
        AND loc.type_id = ?
        AND loc.deleted_at IS NULL
      GROUP BY er.from_entity_id
    `).all(Number(campaignId), npcTypeId, locationTypeId) as Array<{ npc_id: number; count: number }>

    for (const row of locationsCounts) {
      if (result[row.npc_id]) {
        result[row.npc_id].locations = row.count
      }
    }
  }

  // 4. Get memberships count (factions) for all NPCs
  if (factionTypeId) {
    const membershipsCounts = db.prepare(`
      SELECT er.from_entity_id as npc_id, COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities faction ON faction.id = er.to_entity_id
      INNER JOIN entities npc ON npc.id = er.from_entity_id
      WHERE npc.campaign_id = ?
        AND npc.type_id = ?
        AND npc.deleted_at IS NULL
        AND faction.type_id = ?
        AND faction.deleted_at IS NULL
      GROUP BY er.from_entity_id
    `).all(Number(campaignId), npcTypeId, factionTypeId) as Array<{ npc_id: number; count: number }>

    for (const row of membershipsCounts) {
      if (result[row.npc_id]) {
        result[row.npc_id].memberships = row.count
      }
    }

    // Get primary faction name for each NPC (first faction found)
    const factionNames = db.prepare(`
      SELECT npc.id as npc_id, faction.name as faction_name
      FROM entities npc
      INNER JOIN entity_relations er ON er.from_entity_id = npc.id
      INNER JOIN entities faction ON faction.id = er.to_entity_id
      WHERE npc.campaign_id = ?
        AND npc.type_id = ?
        AND npc.deleted_at IS NULL
        AND faction.type_id = ?
        AND faction.deleted_at IS NULL
      GROUP BY npc.id
    `).all(Number(campaignId), npcTypeId, factionTypeId) as Array<{ npc_id: number; faction_name: string }>

    for (const row of factionNames) {
      if (result[row.npc_id]) {
        result[row.npc_id].factionName = row.faction_name
      }
    }
  }

  // 5. Get lore count for all NPCs
  if (loreTypeId) {
    const loreCounts = db.prepare(`
      SELECT er.from_entity_id as npc_id, COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities lore ON lore.id = er.to_entity_id
      INNER JOIN entities npc ON npc.id = er.from_entity_id
      WHERE npc.campaign_id = ?
        AND npc.type_id = ?
        AND npc.deleted_at IS NULL
        AND lore.type_id = ?
        AND lore.deleted_at IS NULL
      GROUP BY er.from_entity_id
    `).all(Number(campaignId), npcTypeId, loreTypeId) as Array<{ npc_id: number; count: number }>

    for (const row of loreCounts) {
      if (result[row.npc_id]) {
        result[row.npc_id].lore = row.count
      }
    }
  }

  // 6. Get players count (bidirectional) for all NPCs
  if (playerTypeId) {
    const playersCounts = db.prepare(`
      SELECT npc_id, COUNT(DISTINCT player_id) as count FROM (
        SELECT er.from_entity_id as npc_id, e.id as player_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        INNER JOIN entities npc ON npc.id = er.from_entity_id
        WHERE npc.campaign_id = ?
          AND npc.type_id = ?
          AND npc.deleted_at IS NULL
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT er.to_entity_id as npc_id, e.id as player_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        INNER JOIN entities npc ON npc.id = er.to_entity_id
        WHERE npc.campaign_id = ?
          AND npc.type_id = ?
          AND npc.deleted_at IS NULL
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      )
      GROUP BY npc_id
    `).all(
      Number(campaignId), npcTypeId, playerTypeId,
      Number(campaignId), npcTypeId, playerTypeId,
    ) as Array<{ npc_id: number; count: number }>

    for (const row of playersCounts) {
      if (result[row.npc_id]) {
        result[row.npc_id].players = row.count
      }
    }
  }

  // 7. Get documents count for all NPCs
  const documentsCounts = db.prepare(`
    SELECT ed.entity_id as npc_id, COUNT(*) as count
    FROM entity_documents ed
    INNER JOIN entities npc ON npc.id = ed.entity_id
    WHERE npc.campaign_id = ?
      AND npc.type_id = ?
      AND npc.deleted_at IS NULL
    GROUP BY ed.entity_id
  `).all(Number(campaignId), npcTypeId) as Array<{ npc_id: number; count: number }>

  for (const row of documentsCounts) {
    if (result[row.npc_id]) {
      result[row.npc_id].documents = row.count
    }
  }

  // 8. Get images count for all NPCs
  const imagesCounts = db.prepare(`
    SELECT ei.entity_id as npc_id, COUNT(*) as count
    FROM entity_images ei
    INNER JOIN entities npc ON npc.id = ei.entity_id
    WHERE npc.campaign_id = ?
      AND npc.type_id = ?
      AND npc.deleted_at IS NULL
    GROUP BY ei.entity_id
  `).all(Number(campaignId), npcTypeId) as Array<{ npc_id: number; count: number }>

  for (const row of imagesCounts) {
    if (result[row.npc_id]) {
      result[row.npc_id].images = row.count
    }
  }

  // 9. Get notes count (sessions mentioning the NPC) for all NPCs
  const notesCounts = db.prepare(`
    SELECT sm.entity_id as npc_id, COUNT(*) as count
    FROM session_mentions sm
    INNER JOIN sessions s ON s.id = sm.session_id
    INNER JOIN entities npc ON npc.id = sm.entity_id
    WHERE npc.campaign_id = ?
      AND npc.type_id = ?
      AND npc.deleted_at IS NULL
      AND s.deleted_at IS NULL
    GROUP BY sm.entity_id
  `).all(Number(campaignId), npcTypeId) as Array<{ npc_id: number; count: number }>

  for (const row of notesCounts) {
    if (result[row.npc_id]) {
      result[row.npc_id].notes = row.count
    }
  }

  return result
})
