import { getDb } from '../../utils/db'

interface GroupInfo {
  id: number
  name: string
  color: string | null
  icon: string | null
}

interface FactionMembership {
  id: number
  name: string
  relationType: string
}

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
  factions: FactionMembership[]
  factionName: string | null // Backwards compatibility
  groups: GroupInfo[]
}

/**
 * GET /api/npcs/batch-counts
 * Returns counts for ALL NPCs in a campaign in one request
 * Replaces N individual /api/npcs/:id/counts requests with 1 batch request
 *
 * OPTIMIZED: Combines multiple queries into fewer, more efficient ones
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
      factions: [],
      factionName: null,
      groups: [],
    }
  }

  // Items (bidirectional)
  if (itemTypeId) {
    const itemsCounts = db.prepare(`
      SELECT npc_id, COUNT(DISTINCT item_id) as count FROM (
        SELECT er.from_entity_id as npc_id, e.id as item_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        INNER JOIN entities npc ON npc.id = er.from_entity_id
        WHERE npc.campaign_id = ?
          AND npc.type_id = ?
          AND npc.deleted_at IS NULL
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT er.to_entity_id as npc_id, e.id as item_id
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
      Number(campaignId), npcTypeId, itemTypeId,
      Number(campaignId), npcTypeId, itemTypeId,
    ) as Array<{ npc_id: number; count: number }>

    for (const row of itemsCounts) {
      if (result[row.npc_id]) {
        result[row.npc_id].items = row.count
      }
    }
  }

  // Locations (bidirectional)
  if (locationTypeId) {
    const locationsCounts = db.prepare(`
      SELECT npc_id, COUNT(DISTINCT loc_id) as count FROM (
        SELECT er.from_entity_id as npc_id, e.id as loc_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        INNER JOIN entities npc ON npc.id = er.from_entity_id
        WHERE npc.campaign_id = ?
          AND npc.type_id = ?
          AND npc.deleted_at IS NULL
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT er.to_entity_id as npc_id, e.id as loc_id
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
      Number(campaignId), npcTypeId, locationTypeId,
      Number(campaignId), npcTypeId, locationTypeId,
    ) as Array<{ npc_id: number; count: number }>

    for (const row of locationsCounts) {
      if (result[row.npc_id]) {
        result[row.npc_id].locations = row.count
      }
    }
  }

  // Memberships/Factions (unidirectional - NPC joins faction)
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
  }

  // Lore (bidirectional)
  if (loreTypeId) {
    const loreCounts = db.prepare(`
      SELECT npc_id, COUNT(DISTINCT lore_id) as count FROM (
        SELECT er.from_entity_id as npc_id, e.id as lore_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        INNER JOIN entities npc ON npc.id = er.from_entity_id
        WHERE npc.campaign_id = ?
          AND npc.type_id = ?
          AND npc.deleted_at IS NULL
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT er.to_entity_id as npc_id, e.id as lore_id
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
      Number(campaignId), npcTypeId, loreTypeId,
      Number(campaignId), npcTypeId, loreTypeId,
    ) as Array<{ npc_id: number; count: number }>

    for (const row of loreCounts) {
      if (result[row.npc_id]) {
        result[row.npc_id].lore = row.count
      }
    }
  }

  // NPC-to-NPC relations (bidirectional) - needs separate query due to UNION
  const relationsCounts = db.prepare(`
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
  `).all(
    Number(campaignId), npcTypeId, npcTypeId,
    Number(campaignId), npcTypeId, npcTypeId,
  ) as Array<{ npc_id: number; count: number }>

  for (const row of relationsCounts) {
    if (result[row.npc_id]) {
      result[row.npc_id].relations = row.count
    }
  }

  // Players (bidirectional) - needs separate query due to UNION
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

  // Faction memberships with relation types
  if (factionTypeId) {
    const factionMemberships = db.prepare(`
      SELECT npc.id as npc_id, faction.id as faction_id, faction.name as faction_name, er.relation_type
      FROM entities npc
      INNER JOIN entity_relations er ON er.from_entity_id = npc.id
      INNER JOIN entities faction ON faction.id = er.to_entity_id
      WHERE npc.campaign_id = ?
        AND npc.type_id = ?
        AND npc.deleted_at IS NULL
        AND faction.type_id = ?
        AND faction.deleted_at IS NULL
      ORDER BY faction.name
    `).all(Number(campaignId), npcTypeId, factionTypeId) as Array<{
      npc_id: number
      faction_id: number
      faction_name: string
      relation_type: string
    }>

    for (const row of factionMemberships) {
      if (result[row.npc_id]) {
        result[row.npc_id].factions.push({
          id: row.faction_id,
          name: row.faction_name,
          relationType: row.relation_type,
        })
        // Backwards compatibility: set first faction name
        if (!result[row.npc_id].factionName) {
          result[row.npc_id].factionName = row.faction_name
        }
      }
    }
  }

  // OPTIMIZED: Combine documents, images, notes into ONE query using UNION ALL
  const attachmentCounts = db.prepare(`
    SELECT npc_id, type, COUNT(*) as count FROM (
      -- Documents
      SELECT ed.entity_id as npc_id, 'documents' as type
      FROM entity_documents ed
      INNER JOIN entities npc ON npc.id = ed.entity_id
      WHERE npc.campaign_id = ?
        AND npc.type_id = ?
        AND npc.deleted_at IS NULL

      UNION ALL

      -- Images
      SELECT ei.entity_id as npc_id, 'images' as type
      FROM entity_images ei
      INNER JOIN entities npc ON npc.id = ei.entity_id
      WHERE npc.campaign_id = ?
        AND npc.type_id = ?
        AND npc.deleted_at IS NULL

      UNION ALL

      -- Notes (session mentions)
      SELECT sm.entity_id as npc_id, 'notes' as type
      FROM session_mentions sm
      INNER JOIN sessions s ON s.id = sm.session_id AND s.deleted_at IS NULL
      INNER JOIN entities npc ON npc.id = sm.entity_id
      WHERE npc.campaign_id = ?
        AND npc.type_id = ?
        AND npc.deleted_at IS NULL
    )
    GROUP BY npc_id, type
  `).all(
    Number(campaignId), npcTypeId,
    Number(campaignId), npcTypeId,
    Number(campaignId), npcTypeId,
  ) as Array<{ npc_id: number; type: string; count: number }>

  for (const row of attachmentCounts) {
    if (!result[row.npc_id]) continue

    if (row.type === 'documents') {
      result[row.npc_id].documents = row.count
    } else if (row.type === 'images') {
      result[row.npc_id].images = row.count
    } else if (row.type === 'notes') {
      result[row.npc_id].notes = row.count
    }
  }

  // Groups - fetch all group memberships for NPCs in this campaign
  const groupMemberships = db.prepare(`
    SELECT
      gm.entity_id as npc_id,
      g.id as group_id,
      g.name as group_name,
      g.color,
      g.icon
    FROM entity_group_members gm
    INNER JOIN entity_groups g ON g.id = gm.group_id AND g.deleted_at IS NULL
    INNER JOIN entities npc ON npc.id = gm.entity_id
    WHERE npc.campaign_id = ?
      AND npc.type_id = ?
      AND npc.deleted_at IS NULL
    ORDER BY g.name
  `).all(Number(campaignId), npcTypeId) as Array<{
    npc_id: number
    group_id: number
    group_name: string
    color: string | null
    icon: string | null
  }>

  for (const row of groupMemberships) {
    if (result[row.npc_id]) {
      result[row.npc_id].groups.push({
        id: row.group_id,
        name: row.group_name,
        color: row.color,
        icon: row.icon,
      })
    }
  }

  return result
})
