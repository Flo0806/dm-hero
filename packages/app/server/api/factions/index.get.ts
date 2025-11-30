import { getDb } from '../../utils/db'
import { createLevenshtein } from '../../utils/levenshtein'
import { parseSearchQuery } from '../../utils/search-query-parser'
import { normalizeText } from '../../utils/normalize'

// Initialize Levenshtein function once
const levenshtein = createLevenshtein()

// Quote FTS5 terms that contain special characters
function quoteFts5Term(term: string): string {
  if (typeof term !== 'string') return ''

  // FTS5 special chars that need quoting: - . () [] {}
  if (
    term.includes('-') ||
    term.includes('.') ||
    term.includes('(') ||
    term.includes(')') ||
    term.includes('[') ||
    term.includes(']')
  ) {
    const escaped = term.replace(/"/g, '""')
    return `"${escaped}"`
  }
  return term
}

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

  // Get entity type IDs
  const entityType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Faction') as
    | { id: number }
    | undefined

  if (!entityType) {
    return []
  }

  // Get NPC, Lore, and Player type IDs for cross-entity search
  const npcType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as
    | { id: number }
    | undefined
  const loreType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Lore') as
    | { id: number }
    | undefined
  const playerType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Player') as
    | { id: number }
    | undefined

  const npcTypeId = npcType?.id
  const loreTypeId = loreType?.id
  const playerTypeId = playerType?.id

  interface FactionRow {
    id: number
    name: string
    description: string | null
    image_url: string | null
    metadata: string | null
    created_at: string
    updated_at: string
    fts_score?: number
    leader_id?: number | null
    leader_name?: string | null
    linked_npc_names?: string | null
    linked_lore_names?: string | null
  }

  interface ScoredFaction extends FactionRow {
    _lev_distance: number
    _final_score: number
  }

  let factions: FactionRow[]

  // HYBRID APPROACH: FTS5 pre-filter + Levenshtein ranking
  if (searchQuery && searchQuery.trim().length > 0) {
    const trimmedQuery = searchQuery.trim()

    // Check if this is a quoted phrase BEFORE normalization
    const isQuotedPhrase = trimmedQuery.startsWith('"') && trimmedQuery.endsWith('"')

    // If quoted, remove quotes, normalize, then re-add quotes
    let searchTerm: string
    if (isQuotedPhrase) {
      const withoutQuotes = trimmedQuery.slice(1, -1) // Remove surrounding quotes
      searchTerm = `"${normalizeText(withoutQuotes)}"` // Normalize and re-add quotes
    } else {
      searchTerm = normalizeText(trimmedQuery)
    }

    // Parse query with operators (AND, OR, NOT)
    const parsedQuery = parseSearchQuery(searchTerm)

    // Build FTS query from parsed terms (quote special chars)
    let ftsQuery: string
    if (parsedQuery.hasOperators) {
      // Reconstruct query with original operators
      const expandedTerms = parsedQuery.terms.map((term) => `${quoteFts5Term(term)}*`)
      const fts5QueryUpper = parsedQuery.fts5Query.toUpperCase()

      if (fts5QueryUpper.includes(' AND ')) {
        ftsQuery = expandedTerms.join(' AND ')
      } else if (fts5QueryUpper.includes(' OR ')) {
        ftsQuery = expandedTerms.join(' OR ')
      } else {
        ftsQuery = expandedTerms.join(' ')
      }
    } else {
      // Simple query: add all terms as OR (quote special chars)
      ftsQuery = parsedQuery.terms.map((t) => `${quoteFts5Term(t)}*`).join(' OR ')
    }

    let useExactMatch = parsedQuery.useExactFirst

    try {
      // Step 1: FTS5 pre-filter (fast, gets ~100 candidates)
      // Note: Cannot use bm25() with GROUP_CONCAT in same query - incompatible aggregations
      factions = db
        .prepare(
          `
        SELECT
          e.id,
          e.name,
          e.description,
          e.image_url,
          e.metadata,
          e.created_at,
          e.updated_at,
          leader_rel.from_entity_id as leader_id,
          leader_npc.name as leader_name,
          GROUP_CONCAT(DISTINCT member_npc.name) as linked_npc_names,
          GROUP_CONCAT(DISTINCT lore.name) as linked_lore_names
        FROM entities_fts fts
        INNER JOIN entities e ON fts.rowid = e.id
        LEFT JOIN entity_relations leader_rel ON leader_rel.to_entity_id = e.id AND leader_rel.relation_type = 'Anführer'
        LEFT JOIN entities leader_npc ON leader_npc.id = leader_rel.from_entity_id AND leader_npc.deleted_at IS NULL
        LEFT JOIN entity_relations member_rel ON member_rel.to_entity_id = e.id
        LEFT JOIN entities member_npc ON member_npc.id = member_rel.from_entity_id AND member_npc.deleted_at IS NULL AND member_npc.type_id = ?
        LEFT JOIN entity_relations lore_rel ON lore_rel.to_entity_id = e.id
        LEFT JOIN entities lore ON lore.id = lore_rel.from_entity_id AND lore.deleted_at IS NULL AND lore.type_id = ?
        WHERE entities_fts MATCH ?
          AND e.type_id = ?
          AND e.campaign_id = ?
          AND e.deleted_at IS NULL
        GROUP BY e.id
        ORDER BY e.name ASC
        LIMIT 300
      `,
        )
        .all(npcTypeId, loreTypeId, ftsQuery, entityType.id, campaignId) as FactionRow[]

      // FALLBACK 1: Try prefix wildcard if exact match found nothing (only for simple queries)
      if (factions.length === 0 && useExactMatch && !parsedQuery.hasOperators) {
        ftsQuery = `${quoteFts5Term(searchTerm)}*`
        useExactMatch = false

        factions = db
          .prepare(
            `
          SELECT
            e.id,
            e.name,
            e.description,
            e.image_url,
            e.metadata,
            e.created_at,
            e.updated_at,
            leader_rel.from_entity_id as leader_id,
            leader_npc.name as leader_name,
            GROUP_CONCAT(DISTINCT member_npc.name) as linked_npc_names,
            GROUP_CONCAT(DISTINCT lore.name) as linked_lore_names
          FROM entities_fts fts
          INNER JOIN entities e ON fts.rowid = e.id
          LEFT JOIN entity_relations leader_rel ON leader_rel.to_entity_id = e.id AND leader_rel.relation_type = 'Anführer'
          LEFT JOIN entities leader_npc ON leader_npc.id = leader_rel.from_entity_id AND leader_npc.deleted_at IS NULL
          LEFT JOIN entity_relations member_rel ON member_rel.to_entity_id = e.id
          LEFT JOIN entities member_npc ON member_npc.id = member_rel.from_entity_id AND member_npc.deleted_at IS NULL AND member_npc.type_id = ?
          LEFT JOIN entity_relations lore_rel ON lore_rel.to_entity_id = e.id
          LEFT JOIN entities lore ON lore.id = lore_rel.from_entity_id AND lore.deleted_at IS NULL AND lore.type_id = ?
          WHERE entities_fts MATCH ?
            AND e.type_id = ?
            AND e.campaign_id = ?
            AND e.deleted_at IS NULL
          GROUP BY e.id
          ORDER BY e.name ASC
          LIMIT 300
        `,
          )
          .all(npcTypeId, loreTypeId, ftsQuery, entityType.id, campaignId) as FactionRow[]
      }

      // FALLBACK 2: For operator queries or when FTS5 returns nothing, use full table scan with Levenshtein
      const hasOrOperator = parsedQuery.fts5Query.toUpperCase().includes(' OR ')
      const hasAndOperator = parsedQuery.fts5Query.toUpperCase().includes(' AND ')

      if (parsedQuery.hasOperators || factions.length === 0) {
        factions = db
          .prepare(
            `
          SELECT
            e.id,
            e.name,
            e.description,
            e.image_url,
            e.metadata,
            e.created_at,
            e.updated_at,
            leader_rel.from_entity_id as leader_id,
            leader_npc.name as leader_name,
            GROUP_CONCAT(DISTINCT member_npc.name) as linked_npc_names,
            GROUP_CONCAT(DISTINCT lore.name) as linked_lore_names
          FROM entities e
          LEFT JOIN entity_relations leader_rel ON leader_rel.to_entity_id = e.id AND leader_rel.relation_type = 'Anführer'
          LEFT JOIN entities leader_npc ON leader_npc.id = leader_rel.from_entity_id AND leader_npc.deleted_at IS NULL
          LEFT JOIN entity_relations member_rel ON member_rel.to_entity_id = e.id
          LEFT JOIN entities member_npc ON member_npc.id = member_rel.from_entity_id AND member_npc.deleted_at IS NULL AND member_npc.type_id = ?
          LEFT JOIN entity_relations lore_rel ON lore_rel.to_entity_id = e.id
          LEFT JOIN entities lore ON lore.id = lore_rel.from_entity_id AND lore.deleted_at IS NULL AND lore.type_id = ?
          WHERE e.type_id = ?
            AND e.campaign_id = ?
            AND e.deleted_at IS NULL
          GROUP BY e.id
          ORDER BY e.name ASC
        `,
          )
          .all(npcTypeId, loreTypeId, entityType.id, campaignId) as FactionRow[]
      }

      // Step 1.5: Separate Player lookup (fast, doesn't slow down main query)
      const factionIdsLinkedToMatchingPlayers = new Set<number>()

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

        // Find Factions linked to matching Players (bidirectional relations)
        if (matchingPlayers.length > 0) {
          const playerIds = matchingPlayers.map((p) => p.id)
          const linkedFactions = db
            .prepare(
              `
              SELECT DISTINCT
                CASE WHEN er.from_entity_id IN (${playerIds.join(',')}) THEN er.to_entity_id
                ELSE er.from_entity_id END as faction_id
              FROM entity_relations er
              WHERE (er.from_entity_id IN (${playerIds.join(',')}) OR er.to_entity_id IN (${playerIds.join(',')}))
            `,
            )
            .all() as Array<{ faction_id: number }>

          for (const row of linkedFactions) {
            factionIdsLinkedToMatchingPlayers.add(row.faction_id)
          }
        }
      }

      // Step 2: Apply Levenshtein distance for better ranking
      let scoredFactions = factions.map((faction: FactionRow): ScoredFaction => {
        const nameLower = normalizeText(faction.name)

        // Smart distance calculation
        const exactMatch = nameLower === searchTerm
        const startsWithQuery = nameLower.startsWith(searchTerm)
        const containsQuery = nameLower.includes(searchTerm)

        // Check if search term appears in metadata, description, leader name, linked NPCs, or linked Lore (FTS5 match but not in name)
        const metadataLower = normalizeText(faction.metadata || '')
        const descriptionLower = normalizeText(faction.description || '')
        const leaderNameLower = normalizeText(faction.leader_name || '')
        const linkedNpcNamesLower = normalizeText(faction.linked_npc_names || '')
        const linkedLoreNamesLower = normalizeText(faction.linked_lore_names || '')
        const isMetadataMatch = metadataLower.includes(searchTerm)
        const isDescriptionMatch = descriptionLower.includes(searchTerm)
        const isLeaderMatch = leaderNameLower.includes(searchTerm)
        const isNpcMatch = linkedNpcNamesLower.includes(searchTerm)
        const isLoreMatch = linkedLoreNamesLower.includes(searchTerm)
        const isPlayerMatch = factionIdsLinkedToMatchingPlayers.has(faction.id)
        const isNonNameMatch =
          (isMetadataMatch || isDescriptionMatch || isLeaderMatch || isNpcMatch || isLoreMatch || isPlayerMatch) &&
          !containsQuery

        let levDistance: number

        if (isNonNameMatch) {
          // Metadata/Description match: Set distance to 0 (perfect match conceptually)
          levDistance = 0
        } else if (startsWithQuery) {
          // If name starts with query, distance is just the remaining chars
          levDistance = nameLower.length - searchTerm.length
        } else {
          // Full Levenshtein distance for non-prefix matches
          levDistance = levenshtein(searchTerm, nameLower)
        }

        // Combined score: FTS score + weighted Levenshtein distance
        const ftsScore = faction.fts_score ?? 0
        let finalScore = ftsScore + levDistance * 0.5

        // Apply bonuses (reduce score = better ranking)
        if (exactMatch) finalScore -= 1000
        if (startsWithQuery) finalScore -= 100
        if (containsQuery) finalScore -= 50
        if (isLoreMatch) finalScore -= 30 // Lore matches are very good
        if (isNpcMatch) finalScore -= 30 // NPC matches are very good
        if (isLeaderMatch) finalScore -= 30 // Leader name matches are very good
        if (isPlayerMatch) finalScore -= 30 // Player matches are very good
        if (isMetadataMatch) finalScore -= 25 // Metadata matches are good
        if (isDescriptionMatch) finalScore -= 10 // Description matches are ok

        return {
          ...faction,
          _lev_distance: levDistance,
          _final_score: finalScore,
        }
      })

      // Step 3: Filter by Levenshtein distance
      const isQuotedPhraseSearch =
        parsedQuery.fts5Query.startsWith('"') && parsedQuery.fts5Query.endsWith('"')

      if (isQuotedPhraseSearch) {
        // Quoted phrase: EXACT substring match (no Levenshtein), but check all fields including cross-entity
        const exactPhrase = parsedQuery.fts5Query.slice(1, -1) // Remove quotes

        scoredFactions = scoredFactions.filter((faction) => {
          // Check if linked to a matching Player
          if (factionIdsLinkedToMatchingPlayers.has(faction.id)) {
            return true
          }

          const nameLower = normalizeText(faction.name)
          const metadataLower = normalizeText(faction.metadata || '')
          const descriptionLower = normalizeText(faction.description || '')
          const leaderNameLower = normalizeText(faction.leader_name || '')
          const linkedNpcNamesLower = normalizeText(faction.linked_npc_names || '')
          const linkedLoreNamesLower = normalizeText(faction.linked_lore_names || '')

          // Check if EXACT phrase appears in ANY field
          return (
            nameLower.includes(exactPhrase) ||
            descriptionLower.includes(exactPhrase) ||
            metadataLower.includes(exactPhrase) ||
            leaderNameLower.includes(exactPhrase) ||
            linkedNpcNamesLower.includes(exactPhrase) ||
            linkedLoreNamesLower.includes(exactPhrase)
          )
        })
      } else if (!parsedQuery.hasOperators) {
        // Simple query: check if ANY term matches
        scoredFactions = scoredFactions.filter((faction) => {
          // Check if linked to a matching Player (fast check first)
          if (factionIdsLinkedToMatchingPlayers.has(faction.id)) {
            return true
          }

          const nameLower = normalizeText(faction.name)
          const metadataLower = normalizeText(faction.metadata || '')
          const descriptionLower = normalizeText(faction.description || '')
          const leaderNameLower = normalizeText(faction.leader_name || '')
          const linkedNpcNamesLower = normalizeText(faction.linked_npc_names || '')
          const linkedLoreNamesLower = normalizeText(faction.linked_lore_names || '')

          // Check ALL terms
          for (const term of parsedQuery.terms) {
            // Exact/substring match in any field
            if (
              nameLower.includes(term) ||
              descriptionLower.includes(term) ||
              metadataLower.includes(term) ||
              leaderNameLower.includes(term) ||
              linkedNpcNamesLower.includes(term) ||
              linkedLoreNamesLower.includes(term)
            ) {
              return true
            }

            // Prefix match (before Levenshtein for performance)
            if (nameLower.startsWith(term)) {
              return true
            }

            // Levenshtein match for name
            const termLength = term.length
            const maxDist = termLength <= 3 ? 2 : termLength <= 6 ? 3 : 4
            const levDist = levenshtein(term, nameLower)

            if (levDist <= maxDist) {
              return true
            }

            // Levenshtein match for leader_name
            if (leaderNameLower.length > 0) {
              const leaderLevDist = levenshtein(term, leaderNameLower)
              if (leaderLevDist <= maxDist) {
                return true
              }
            }

            // Levenshtein match for linked NPC names (split by comma, then by words)
            if (linkedNpcNamesLower.length > 0) {
              const npcNames = linkedNpcNamesLower.split(',').map((n) => n.trim())
              for (const npcName of npcNames) {
                if (npcName.length === 0) continue
                // Split each NPC name into words (e.g., "andré müller" → ["andré", "müller"])
                const npcWords = npcName.split(/\s+/)
                for (const word of npcWords) {
                  if (word.length === 0) continue
                  const npcLevDist = levenshtein(term, word)
                  if (npcLevDist <= maxDist) {
                    return true
                  }
                }
              }
            }

            // Levenshtein match for linked Lore names (split by comma, then by words)
            if (linkedLoreNamesLower.length > 0) {
              const loreNames = linkedLoreNamesLower.split(',').map((n) => n.trim())
              for (const loreName of loreNames) {
                if (loreName.length === 0) continue
                // Split each Lore name into words (e.g., "böser frosch" → ["böser", "frosch"])
                const loreWords = loreName.split(/\s+/)
                for (const word of loreWords) {
                  if (word.length === 0) continue
                  const loreLevDist = levenshtein(term, word)
                  if (loreLevDist <= maxDist) {
                    return true
                  }
                }
              }
            }
          }

          return false // No term matched
        })
      } else if (hasOrOperator && !hasAndOperator) {
        // OR query: at least ONE term must match
        scoredFactions = scoredFactions.filter((faction) => {
          // Check if linked to a matching Player (fast check first)
          if (factionIdsLinkedToMatchingPlayers.has(faction.id)) {
            return true
          }

          const nameLower = normalizeText(faction.name)
          const metadataLower = normalizeText(faction.metadata || '')
          const descriptionLower = normalizeText(faction.description || '')
          const leaderNameLower = normalizeText(faction.leader_name || '')
          const linkedNpcNamesLower = normalizeText(faction.linked_npc_names || '')
          const linkedLoreNamesLower = normalizeText(faction.linked_lore_names || '')

          // Check if at least one term matches
          for (const term of parsedQuery.terms) {
            // Check if term appears in any field
            if (
              nameLower.includes(term) ||
              descriptionLower.includes(term) ||
              metadataLower.includes(term) ||
              leaderNameLower.includes(term) ||
              linkedNpcNamesLower.includes(term) ||
              linkedLoreNamesLower.includes(term)
            ) {
              return true
            }

            // Prefix match (before Levenshtein for performance)
            if (nameLower.startsWith(term)) {
              return true
            }

            // Check Levenshtein for name
            const termLength = term.length
            const maxDist = termLength <= 3 ? 2 : termLength <= 6 ? 3 : 4
            const levDist = levenshtein(term, nameLower)

            if (levDist <= maxDist) {
              return true // Close enough match
            }

            // Check Levenshtein for leader_name
            if (leaderNameLower.length > 0) {
              const leaderLevDist = levenshtein(term, leaderNameLower)
              if (leaderLevDist <= maxDist) {
                return true // Close enough match
              }
            }

            // Levenshtein match for linked NPC names (split by comma, then by words)
            if (linkedNpcNamesLower.length > 0) {
              const npcNames = linkedNpcNamesLower.split(',').map((n) => n.trim())
              for (const npcName of npcNames) {
                if (npcName.length === 0) continue
                const npcWords = npcName.split(/\s+/)
                for (const word of npcWords) {
                  if (word.length === 0) continue
                  const npcLevDist = levenshtein(term, word)
                  if (npcLevDist <= maxDist) {
                    return true
                  }
                }
              }
            }

            // Levenshtein match for linked Lore names (split by comma, then by words)
            if (linkedLoreNamesLower.length > 0) {
              const loreNames = linkedLoreNamesLower.split(',').map((n) => n.trim())
              for (const loreName of loreNames) {
                if (loreName.length === 0) continue
                const loreWords = loreName.split(/\s+/)
                for (const word of loreWords) {
                  if (word.length === 0) continue
                  const loreLevDist = levenshtein(term, word)
                  if (loreLevDist <= maxDist) {
                    return true
                  }
                }
              }
            }
          }
          return false // No term matched
        })
      } else if (hasAndOperator) {
        // AND query: ALL terms must match
        scoredFactions = scoredFactions.filter((faction) => {
          const nameLower = normalizeText(faction.name)
          const metadataLower = normalizeText(faction.metadata || '')
          const descriptionLower = normalizeText(faction.description || '')
          const leaderNameLower = normalizeText(faction.leader_name || '')
          const linkedNpcNamesLower = normalizeText(faction.linked_npc_names || '')
          const linkedLoreNamesLower = normalizeText(faction.linked_lore_names || '')

          // Check if linked to a matching Player (can satisfy any term)
          const isPlayerMatch = factionIdsLinkedToMatchingPlayers.has(faction.id)

          // Check if ALL terms match
          for (const term of parsedQuery.terms) {
            let termMatches = isPlayerMatch // Player match can satisfy any term

            // Check if term appears in any field
            if (
              nameLower.includes(term) ||
              descriptionLower.includes(term) ||
              metadataLower.includes(term) ||
              leaderNameLower.includes(term) ||
              linkedNpcNamesLower.includes(term) ||
              linkedLoreNamesLower.includes(term)
            ) {
              termMatches = true
            }

            // Prefix match (before Levenshtein for performance)
            if (!termMatches && nameLower.startsWith(term)) {
              termMatches = true
            }

            // Check Levenshtein for name
            if (!termMatches) {
              const termLength = term.length
              const maxDist = termLength <= 3 ? 2 : termLength <= 6 ? 3 : 4
              const levDist = levenshtein(term, nameLower)

              if (levDist <= maxDist) {
                termMatches = true
              }
            }

            // Check Levenshtein for leader_name
            if (!termMatches && leaderNameLower.length > 0) {
              const termLength = term.length
              const maxDist = termLength <= 3 ? 2 : termLength <= 6 ? 3 : 4
              const leaderLevDist = levenshtein(term, leaderNameLower)

              if (leaderLevDist <= maxDist) {
                termMatches = true
              }
            }

            // Check Levenshtein for linked NPC names (split by comma, then by words)
            if (!termMatches && linkedNpcNamesLower.length > 0) {
              const npcNames = linkedNpcNamesLower.split(',').map((n) => n.trim())
              for (const npcName of npcNames) {
                if (npcName.length === 0) continue
                // Split each NPC name into words (e.g., "andré müller" → ["andré", "müller"])
                const npcWords = npcName.split(/\s+/)
                for (const word of npcWords) {
                  if (word.length === 0) continue
                  const termLength = term.length
                  const maxDist = termLength <= 3 ? 2 : termLength <= 6 ? 3 : 4
                  const npcLevDist = levenshtein(term, word)
                  if (npcLevDist <= maxDist) {
                    termMatches = true
                    break
                  }
                }
                if (termMatches) break
              }
            }

            // Check Levenshtein for linked Lore names (split by comma, then by words)
            if (!termMatches && linkedLoreNamesLower.length > 0) {
              const loreNames = linkedLoreNamesLower.split(',').map((n) => n.trim())
              for (const loreName of loreNames) {
                if (loreName.length === 0) continue
                // Split each Lore name into words (e.g., "böser frosch" → ["böser", "frosch"])
                const loreWords = loreName.split(/\s+/)
                for (const word of loreWords) {
                  if (word.length === 0) continue
                  const termLength = term.length
                  const maxDist = termLength <= 3 ? 2 : termLength <= 6 ? 3 : 4
                  const loreLevDist = levenshtein(term, word)
                  if (loreLevDist <= maxDist) {
                    termMatches = true
                    break
                  }
                }
                if (termMatches) break
              }
            }

            // If this term doesn't match, reject the faction
            if (!termMatches) {
              return false
            }
          }

          // All terms matched!
          return true
        })
      }

      // Step 4: Sort by combined score and take top 50
      scoredFactions.sort((a, b) => a._final_score - b._final_score)
      scoredFactions = scoredFactions.slice(0, 50)

      // Clean up scoring metadata
      factions = scoredFactions.map(
        ({ fts_score: _fts_score, _lev_distance, _final_score, ...faction }) => faction,
      )
    } catch (error) {
      // Fallback: If FTS5 fails, return empty (better than crashing)
      console.error('[Faction Search] FTS5 search failed:', error)
      factions = []
    }
  } else {
    // No search query - return all factions for this campaign
    factions = db
      .prepare(
        `
      SELECT
        e.id,
        e.name,
        e.description,
        e.image_url,
        e.metadata,
        e.created_at,
        e.updated_at,
        leader_rel.from_entity_id as leader_id,
        leader_npc.name as leader_name,
        GROUP_CONCAT(DISTINCT member_npc.name) as linked_npc_names,
        GROUP_CONCAT(DISTINCT lore.name) as linked_lore_names
      FROM entities e
      LEFT JOIN entity_relations leader_rel ON leader_rel.to_entity_id = e.id AND leader_rel.relation_type = 'Anführer'
      LEFT JOIN entities leader_npc ON leader_npc.id = leader_rel.from_entity_id AND leader_npc.deleted_at IS NULL
      LEFT JOIN entity_relations member_rel ON member_rel.to_entity_id = e.id
      LEFT JOIN entities member_npc ON member_npc.id = member_rel.from_entity_id AND member_npc.deleted_at IS NULL AND member_npc.type_id = ?
      LEFT JOIN entity_relations lore_rel ON lore_rel.to_entity_id = e.id
      LEFT JOIN entities lore ON lore.id = lore_rel.from_entity_id AND lore.deleted_at IS NULL AND lore.type_id = ?
      WHERE e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
      GROUP BY e.id
      ORDER BY e.name ASC
    `,
      )
      .all(npcTypeId, loreTypeId, entityType.id, campaignId) as FactionRow[]
  }

  // Parse metadata JSON
  return factions.map((faction) => ({
    ...faction,
    metadata: faction.metadata ? JSON.parse(faction.metadata as string) : null,
  }))
})
