import { getDb } from '../../utils/db'
import { createLevenshtein } from '../../utils/levenshtein'
import { normalizeText } from '../../utils/normalize'

// Initialize Levenshtein function once
const levenshtein = createLevenshtein()

export default defineEventHandler((event) => {
  const db = getDb()
  const query = getQuery(event)
  const campaignId = query.campaignId as string
  const searchQuery = query.search as string | undefined

  if (!campaignId) {
    throw createError({
      statusCode: 400,
      message: 'Campaign ID is required',
    })
  }

  // Get Player entity type ID
  const entityType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Player') as
    | { id: number }
    | undefined

  if (!entityType) {
    return []
  }

  // Get all other entity type IDs for cross-entity search
  const npcType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as { id: number } | undefined
  const itemType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Item') as { id: number } | undefined
  const factionType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Faction') as
    | { id: number }
    | undefined
  const loreType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Lore') as { id: number } | undefined
  const locationType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Location') as
    | { id: number }
    | undefined

  interface PlayerRow {
    id: number
    name: string
    description: string | null
    image_url: string | null
    metadata: string | null
    created_at: string
    updated_at: string
  }

  let players: PlayerRow[]

  if (searchQuery && searchQuery.trim().length > 0) {
    const searchTerm = normalizeText(searchQuery.trim())

    // Step 1: Find Players matching the search term directly
    players = db
      .prepare<unknown[], PlayerRow>(
        `
      SELECT e.id, e.name, e.description, e.metadata, e.created_at, e.updated_at,
             ei.image_url
      FROM entities e
      LEFT JOIN (
        SELECT entity_id, image_url
        FROM entity_images
        WHERE is_primary = 1
      ) ei ON ei.entity_id = e.id
      WHERE e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
        AND (
          LOWER(e.name) LIKE ?
          OR LOWER(e.description) LIKE ?
          OR LOWER(e.metadata) LIKE ?
        )
      ORDER BY e.name ASC
    `,
      )
      .all(entityType.id, campaignId, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`)

    // Step 2: Cross-entity search - find Players linked to matching entities
    const playerIdsLinkedToMatchingEntities = new Set<number>()

    // Collect all entity type IDs that exist
    const entityTypeIds = [npcType?.id, itemType?.id, factionType?.id, loreType?.id, locationType?.id].filter(
      (id): id is number => id !== undefined,
    )

    console.log('[Player Search] entityTypeIds:', entityTypeIds, 'loreType:', loreType)

    if (entityTypeIds.length > 0) {
      // Find ALL entities of these types in this campaign
      const allEntities = db
        .prepare(
          `
          SELECT id, name, type_id FROM entities
          WHERE type_id IN (${entityTypeIds.join(',')})
            AND campaign_id = ?
            AND deleted_at IS NULL
        `,
        )
        .all(campaignId) as Array<{ id: number; name: string; type_id: number }>

      console.log('[Player Search] allEntities count:', allEntities.length)

      // Filter entities with substring match OR Levenshtein distance
      const maxDist = searchTerm.length <= 3 ? 1 : searchTerm.length <= 6 ? 2 : 3
      const matchingEntities = allEntities.filter((entity) => {
        const entityNameNormalized = normalizeText(entity.name)

        // Substring match
        if (entityNameNormalized.includes(searchTerm)) return true

        // Full name Levenshtein
        if (levenshtein(searchTerm, entityNameNormalized) <= maxDist) return true

        // Word-level Levenshtein (for multi-word names)
        const words = entityNameNormalized.split(/\s+/)
        for (const word of words) {
          if (word.length < 3) continue
          if (levenshtein(searchTerm, word) <= maxDist) return true
        }

        return false
      })

      console.log('[Player Search] searchTerm:', searchTerm, 'matchingEntities:', matchingEntities.map((e) => ({ id: e.id, name: e.name })))

      // Find Players linked to matching entities (bidirectional relations)
      if (matchingEntities.length > 0) {
        const entityIds = matchingEntities.map((e) => e.id)
        const linkedPlayers = db
          .prepare(
            `
            SELECT DISTINCT
              CASE WHEN er.from_entity_id IN (${entityIds.join(',')}) THEN er.to_entity_id
              ELSE er.from_entity_id END as player_id
            FROM entity_relations er
            WHERE (er.from_entity_id IN (${entityIds.join(',')}) OR er.to_entity_id IN (${entityIds.join(',')}))
          `,
          )
          .all() as Array<{ player_id: number }>

        console.log('[Player Search] linkedPlayers from relations:', linkedPlayers)

        for (const row of linkedPlayers) {
          playerIdsLinkedToMatchingEntities.add(row.player_id)
        }
      }
    }

    // Step 3: If we found Players via entity links, add them to results
    if (playerIdsLinkedToMatchingEntities.size > 0) {
      const existingIds = new Set(players.map((p) => p.id))

      // Get Players linked to entities that aren't already in results
      const additionalPlayerIds = [...playerIdsLinkedToMatchingEntities].filter((id) => !existingIds.has(id))

      if (additionalPlayerIds.length > 0) {
        const additionalPlayers = db
          .prepare<unknown[], PlayerRow>(
            `
          SELECT e.id, e.name, e.description, e.metadata, e.created_at, e.updated_at,
                 ei.image_url
          FROM entities e
          LEFT JOIN (
            SELECT entity_id, image_url
            FROM entity_images
            WHERE is_primary = 1
          ) ei ON ei.entity_id = e.id
          WHERE e.id IN (${additionalPlayerIds.join(',')})
            AND e.type_id = ?
            AND e.deleted_at IS NULL
          ORDER BY e.name ASC
        `,
          )
          .all(entityType.id)

        // Add entity-linked Players to results
        players = [...players, ...additionalPlayers]
      }
    }
  } else {
    players = db
      .prepare<unknown[], PlayerRow>(
        `
      SELECT e.id, e.name, e.description, e.metadata, e.created_at, e.updated_at,
             ei.image_url
      FROM entities e
      LEFT JOIN (
        SELECT entity_id, image_url
        FROM entity_images
        WHERE is_primary = 1
      ) ei ON ei.entity_id = e.id
      WHERE e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
      ORDER BY e.name ASC
    `,
      )
      .all(entityType.id, campaignId)
  }

  return players.map((player) => ({
    ...player,
    metadata: player.metadata ? JSON.parse(player.metadata) : null,
  }))
})
