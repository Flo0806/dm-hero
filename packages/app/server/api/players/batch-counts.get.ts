import { getDb } from '../../utils/db'

interface PlayerCounts {
  characters: number
  items: number
  locations: number
  factions: number
  lore: number
  sessions: number
  documents: number
  images: number
}

/**
 * GET /api/players/batch-counts
 * Returns counts for ALL players in a campaign in one request
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
    .prepare('SELECT id, name FROM entity_types WHERE name IN (\'Player\', \'NPC\', \'Item\', \'Location\', \'Faction\', \'Lore\')')
    .all() as Array<{ id: number; name: string }>

  const typeMap = Object.fromEntries(entityTypes.map((t) => [t.name, t.id]))
  const playerTypeId = typeMap['Player']
  const npcTypeId = typeMap['NPC']
  const itemTypeId = typeMap['Item']
  const locationTypeId = typeMap['Location']
  const factionTypeId = typeMap['Faction']
  const loreTypeId = typeMap['Lore']

  if (!playerTypeId) {
    return {}
  }

  // Get all Player IDs for this campaign
  const playerIds = db
    .prepare('SELECT id FROM entities WHERE campaign_id = ? AND type_id = ? AND deleted_at IS NULL')
    .all(Number(campaignId), playerTypeId) as Array<{ id: number }>

  if (playerIds.length === 0) {
    return {}
  }

  const result: Record<number, PlayerCounts> = {}

  // Initialize all players with zero counts
  for (const player of playerIds) {
    result[player.id] = {
      characters: 0,
      items: 0,
      locations: 0,
      factions: 0,
      lore: 0,
      sessions: 0,
      documents: 0,
      images: 0,
    }
  }

  // 1. Get characters count (NPCs the player plays)
  if (npcTypeId) {
    const charactersCounts = db.prepare(`
      SELECT er.from_entity_id as player_id, COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities npc ON npc.id = er.to_entity_id
      INNER JOIN entities player ON player.id = er.from_entity_id
      WHERE player.campaign_id = ?
        AND player.type_id = ?
        AND player.deleted_at IS NULL
        AND npc.type_id = ?
        AND npc.deleted_at IS NULL
      GROUP BY er.from_entity_id
    `).all(Number(campaignId), playerTypeId, npcTypeId) as Array<{ player_id: number; count: number }>

    for (const row of charactersCounts) {
      if (result[row.player_id]) {
        result[row.player_id].characters = row.count
      }
    }
  }

  // 2. Get items count
  if (itemTypeId) {
    const itemsCounts = db.prepare(`
      SELECT er.from_entity_id as player_id, COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities item ON item.id = er.to_entity_id
      INNER JOIN entities player ON player.id = er.from_entity_id
      WHERE player.campaign_id = ?
        AND player.type_id = ?
        AND player.deleted_at IS NULL
        AND item.type_id = ?
        AND item.deleted_at IS NULL
      GROUP BY er.from_entity_id
    `).all(Number(campaignId), playerTypeId, itemTypeId) as Array<{ player_id: number; count: number }>

    for (const row of itemsCounts) {
      if (result[row.player_id]) {
        result[row.player_id].items = row.count
      }
    }
  }

  // 3. Get locations count
  if (locationTypeId) {
    const locationsCounts = db.prepare(`
      SELECT er.from_entity_id as player_id, COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities loc ON loc.id = er.to_entity_id
      INNER JOIN entities player ON player.id = er.from_entity_id
      WHERE player.campaign_id = ?
        AND player.type_id = ?
        AND player.deleted_at IS NULL
        AND loc.type_id = ?
        AND loc.deleted_at IS NULL
      GROUP BY er.from_entity_id
    `).all(Number(campaignId), playerTypeId, locationTypeId) as Array<{ player_id: number; count: number }>

    for (const row of locationsCounts) {
      if (result[row.player_id]) {
        result[row.player_id].locations = row.count
      }
    }
  }

  // 4. Get factions count
  if (factionTypeId) {
    const factionsCounts = db.prepare(`
      SELECT er.from_entity_id as player_id, COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities faction ON faction.id = er.to_entity_id
      INNER JOIN entities player ON player.id = er.from_entity_id
      WHERE player.campaign_id = ?
        AND player.type_id = ?
        AND player.deleted_at IS NULL
        AND faction.type_id = ?
        AND faction.deleted_at IS NULL
      GROUP BY er.from_entity_id
    `).all(Number(campaignId), playerTypeId, factionTypeId) as Array<{ player_id: number; count: number }>

    for (const row of factionsCounts) {
      if (result[row.player_id]) {
        result[row.player_id].factions = row.count
      }
    }
  }

  // 5. Get lore count
  if (loreTypeId) {
    const loreCounts = db.prepare(`
      SELECT er.from_entity_id as player_id, COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities lore ON lore.id = er.to_entity_id
      INNER JOIN entities player ON player.id = er.from_entity_id
      WHERE player.campaign_id = ?
        AND player.type_id = ?
        AND player.deleted_at IS NULL
        AND lore.type_id = ?
        AND lore.deleted_at IS NULL
      GROUP BY er.from_entity_id
    `).all(Number(campaignId), playerTypeId, loreTypeId) as Array<{ player_id: number; count: number }>

    for (const row of loreCounts) {
      if (result[row.player_id]) {
        result[row.player_id].lore = row.count
      }
    }
  }

  // 6. Get sessions count (where players are mentioned)
  const sessionsCounts = db.prepare(`
    SELECT sm.entity_id as player_id, COUNT(*) as count
    FROM session_mentions sm
    INNER JOIN sessions s ON s.id = sm.session_id
    INNER JOIN entities player ON player.id = sm.entity_id
    WHERE player.campaign_id = ?
      AND player.type_id = ?
      AND player.deleted_at IS NULL
      AND s.deleted_at IS NULL
    GROUP BY sm.entity_id
  `).all(Number(campaignId), playerTypeId) as Array<{ player_id: number; count: number }>

  for (const row of sessionsCounts) {
    if (result[row.player_id]) {
      result[row.player_id].sessions = row.count
    }
  }

  // 7. Get documents count
  const documentsCounts = db.prepare(`
    SELECT ed.entity_id as player_id, COUNT(*) as count
    FROM entity_documents ed
    INNER JOIN entities player ON player.id = ed.entity_id
    WHERE player.campaign_id = ?
      AND player.type_id = ?
      AND player.deleted_at IS NULL
    GROUP BY ed.entity_id
  `).all(Number(campaignId), playerTypeId) as Array<{ player_id: number; count: number }>

  for (const row of documentsCounts) {
    if (result[row.player_id]) {
      result[row.player_id].documents = row.count
    }
  }

  // 8. Get images count
  const imagesCounts = db.prepare(`
    SELECT ei.entity_id as player_id, COUNT(*) as count
    FROM entity_images ei
    INNER JOIN entities player ON player.id = ei.entity_id
    WHERE player.campaign_id = ?
      AND player.type_id = ?
      AND player.deleted_at IS NULL
    GROUP BY ei.entity_id
  `).all(Number(campaignId), playerTypeId) as Array<{ player_id: number; count: number }>

  for (const row of imagesCounts) {
    if (result[row.player_id]) {
      result[row.player_id].images = row.count
    }
  }

  return result
})
