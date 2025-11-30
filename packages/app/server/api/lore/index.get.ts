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

  // Get Lore entity type ID
  const entityType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Lore') as
    | { id: number }
    | undefined

  if (!entityType) {
    return []
  }

  // Get Player type ID for cross-entity search
  const playerType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Player') as
    | { id: number }
    | undefined

  const playerTypeId = playerType?.id

  interface LoreRow {
    id: number
    name: string
    description: string | null
    image_url: string | null
    metadata: string | null
    created_at: string
    updated_at: string
  }

  let loreEntries: LoreRow[]

  // Search implementation with Player cross-search
  if (searchQuery && searchQuery.trim().length > 0) {
    const searchTerm = normalizeText(searchQuery.trim())

    // Step 1: Find Lore entries matching the search term directly
    loreEntries = db
      .prepare<unknown[], LoreRow>(
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
        )
      ORDER BY e.updated_at DESC
    `,
      )
      .all(entityType.id, campaignId, `%${searchTerm}%`, `%${searchTerm}%`)

    // Step 2: Separate Player lookup for cross-entity search
    const loreIdsLinkedToMatchingPlayers = new Set<number>()

    if (playerTypeId) {
      // Find ALL Players in this campaign, then filter with Levenshtein
      const allPlayers = db
        .prepare(
          `
          SELECT id, name FROM entities
          WHERE type_id = ? AND campaign_id = ? AND deleted_at IS NULL
        `,
        )
        .all(playerTypeId, campaignId) as Array<{ id: number; name: string }>

      // Filter Players with substring match OR Levenshtein distance
      const maxDist = searchTerm.length <= 3 ? 1 : searchTerm.length <= 6 ? 2 : 3
      const matchingPlayers = allPlayers.filter((player) => {
        const playerNameNormalized = normalizeText(player.name)

        // Substring match
        if (playerNameNormalized.includes(searchTerm)) return true

        // Full name Levenshtein
        if (levenshtein(searchTerm, playerNameNormalized) <= maxDist) return true

        // Word-level Levenshtein (for multi-word names like "Stephan Müller")
        const words = playerNameNormalized.split(/\s+/)
        for (const word of words) {
          if (word.length < 3) continue
          if (levenshtein(searchTerm, word) <= maxDist) return true
        }

        return false
      })

      // Find Lore entries linked to matching Players (bidirectional relations)
      if (matchingPlayers.length > 0) {
        const playerIds = matchingPlayers.map((p) => p.id)
        const linkedLore = db
          .prepare(
            `
            SELECT DISTINCT
              CASE WHEN er.from_entity_id IN (${playerIds.join(',')}) THEN er.to_entity_id
              ELSE er.from_entity_id END as lore_id
            FROM entity_relations er
            WHERE (er.from_entity_id IN (${playerIds.join(',')}) OR er.to_entity_id IN (${playerIds.join(',')}))
          `,
          )
          .all() as Array<{ lore_id: number }>

        for (const row of linkedLore) {
          loreIdsLinkedToMatchingPlayers.add(row.lore_id)
        }
      }
    }

    // Step 3: If we found Lore via Player links, add them to results
    if (loreIdsLinkedToMatchingPlayers.size > 0) {
      const existingIds = new Set(loreEntries.map((l) => l.id))

      // Get Lore entries linked to Players that aren't already in results
      const additionalLoreIds = [...loreIdsLinkedToMatchingPlayers].filter((id) => !existingIds.has(id))

      if (additionalLoreIds.length > 0) {
        const additionalLore = db
          .prepare<unknown[], LoreRow>(
            `
          SELECT e.id, e.name, e.description, e.metadata, e.created_at, e.updated_at,
                 ei.image_url
          FROM entities e
          LEFT JOIN (
            SELECT entity_id, image_url
            FROM entity_images
            WHERE is_primary = 1
          ) ei ON ei.entity_id = e.id
          WHERE e.id IN (${additionalLoreIds.join(',')})
            AND e.type_id = ?
            AND e.deleted_at IS NULL
          ORDER BY e.updated_at DESC
        `,
          )
          .all(entityType.id)

        // Add Player-linked Lore to results
        loreEntries = [...loreEntries, ...additionalLore]
      }
    }
  } else {
    // No search - return all lore entries
    loreEntries = db
      .prepare<unknown[], LoreRow>(
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
      ORDER BY e.updated_at DESC
    `,
      )
      .all(entityType.id, campaignId)
  }

  // Parse metadata JSON
  return loreEntries.map((lore) => ({
    ...lore,
    metadata: lore.metadata ? JSON.parse(lore.metadata) : null,
  }))
})
