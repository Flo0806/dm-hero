import { getDb } from '../../utils/db'
import { createLevenshtein } from '../../utils/levenshtein'
import { parseSearchQuery } from '../../utils/search-query-parser'
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

  // Get Location entity type ID
  const entityType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Location') as { id: number } | undefined

  if (!entityType) {
    return []
  }

  interface LocationRow {
    id: number
    name: string
    description: string | null
    image_url: string | null
    primary_image_url?: string | null
    metadata: string | null
    created_at: string
    updated_at: string
    fts_score?: number
    linked_npc_names?: string | null
    linked_item_names?: string | null
  }

  interface ScoredLocation extends LocationRow {
    _lev_distance: number
    _final_score: number
  }

  let locations: LocationRow[]

  // HYBRID APPROACH: FTS5 pre-filter + Levenshtein ranking
  if (searchQuery && searchQuery.trim().length > 0) {
    const searchTerm = normalizeText(searchQuery.trim())

    // Parse query with operators (AND, OR, NOT)
    const parsedQuery = parseSearchQuery(searchTerm)

    // Build FTS query from parsed terms
    let ftsQuery: string
    if (parsedQuery.hasOperators) {
      // Reconstruct query with original operators
      const expandedTerms = parsedQuery.terms.map(term => `${term}*`)
      const fts5QueryUpper = parsedQuery.fts5Query.toUpperCase()

      if (fts5QueryUpper.includes(' AND ')) {
        ftsQuery = expandedTerms.join(' AND ')
      }
      else if (fts5QueryUpper.includes(' OR ')) {
        ftsQuery = expandedTerms.join(' OR ')
      }
      else {
        ftsQuery = expandedTerms.join(' ')
      }
    }
    else {
      // Simple query: add all terms as OR
      ftsQuery = parsedQuery.terms.map(t => `${t}*`).join(' OR ')
    }

    let useExactMatch = parsedQuery.useExactFirst

    try {
      // Step 1: FTS5 pre-filter (fast, gets ~100 candidates)
      // Note: Cannot use bm25() with GROUP_CONCAT in same query
      locations = db.prepare(`
        SELECT
          e.id,
          e.name,
          e.description,
          e.image_url,
          e.metadata,
          e.created_at,
          e.updated_at,
          ei.image_url as primary_image_url,
          GROUP_CONCAT(DISTINCT npc.name) as linked_npc_names,
          GROUP_CONCAT(DISTINCT item.name) as linked_item_names
        FROM entities_fts fts
        INNER JOIN entities e ON fts.rowid = e.id
        LEFT JOIN entity_images ei ON e.id = ei.entity_id AND ei.is_primary = 1
        LEFT JOIN entity_relations npc_rel ON npc_rel.to_entity_id = e.id
        LEFT JOIN entities npc ON npc.id = npc_rel.from_entity_id AND npc.deleted_at IS NULL AND npc.type_id = (SELECT id FROM entity_types WHERE name = 'NPC')
        LEFT JOIN entity_relations item_rel ON item_rel.to_entity_id = e.id
        LEFT JOIN entities item ON item.id = item_rel.from_entity_id AND item.deleted_at IS NULL AND item.type_id = (SELECT id FROM entity_types WHERE name = 'Item')
        WHERE entities_fts MATCH ?
          AND e.type_id = ?
          AND e.campaign_id = ?
          AND e.deleted_at IS NULL
        GROUP BY e.id
        ORDER BY e.name ASC
        LIMIT 300
      `).all(ftsQuery, entityType.id, campaignId) as LocationRow[]

      // FALLBACK 1: Try prefix wildcard if exact match found nothing (only for simple queries)
      if (locations.length === 0 && useExactMatch && !parsedQuery.hasOperators) {
        ftsQuery = `${searchTerm}*`
        useExactMatch = false

        locations = db.prepare(`
          SELECT
            e.id,
            e.name,
            e.description,
            e.image_url,
            e.metadata,
            e.created_at,
            e.updated_at,
            ei.image_url as primary_image_url,
            GROUP_CONCAT(DISTINCT npc.name) as linked_npc_names,
            GROUP_CONCAT(DISTINCT item.name) as linked_item_names
          FROM entities_fts fts
          INNER JOIN entities e ON fts.rowid = e.id
          LEFT JOIN entity_images ei ON e.id = ei.entity_id AND ei.is_primary = 1
          LEFT JOIN entity_relations npc_rel ON npc_rel.to_entity_id = e.id
          LEFT JOIN entities npc ON npc.id = npc_rel.from_entity_id AND npc.deleted_at IS NULL AND npc.type_id = (SELECT id FROM entity_types WHERE name = 'NPC')
          LEFT JOIN entity_relations item_rel ON item_rel.to_entity_id = e.id
          LEFT JOIN entities item ON item.id = item_rel.from_entity_id AND item.deleted_at IS NULL AND item.type_id = (SELECT id FROM entity_types WHERE name = 'Item')
          WHERE entities_fts MATCH ?
            AND e.type_id = ?
            AND e.campaign_id = ?
            AND e.deleted_at IS NULL
          GROUP BY e.id
          ORDER BY e.name ASC
          LIMIT 300
        `).all(ftsQuery, entityType.id, campaignId) as LocationRow[]
      }

      // Step 1.5: Always load all locations with linked entities
      // FTS5 only searches entity fields (name, description, metadata),
      // but we need linked NPC/Item names for cross-entity search
      const hasOrOperator = parsedQuery.fts5Query.toUpperCase().includes(' OR ')
      const hasAndOperator = parsedQuery.fts5Query.toUpperCase().includes(' AND ')

      locations = db.prepare(`
        SELECT
          e.id,
          e.name,
          e.description,
          e.image_url,
          e.metadata,
          e.created_at,
          e.updated_at,
          ei.image_url as primary_image_url,
          GROUP_CONCAT(DISTINCT npc.name) as linked_npc_names,
          GROUP_CONCAT(DISTINCT item.name) as linked_item_names
        FROM entities e
        LEFT JOIN entity_images ei ON e.id = ei.entity_id AND ei.is_primary = 1
        LEFT JOIN entity_relations npc_rel ON npc_rel.to_entity_id = e.id
        LEFT JOIN entities npc ON npc.id = npc_rel.from_entity_id AND npc.deleted_at IS NULL AND npc.type_id = (SELECT id FROM entity_types WHERE name = 'NPC')
        LEFT JOIN entity_relations item_rel ON item_rel.to_entity_id = e.id
        LEFT JOIN entities item ON item.id = item_rel.from_entity_id AND item.deleted_at IS NULL AND item.type_id = (SELECT id FROM entity_types WHERE name = 'Item')
        WHERE e.type_id = ?
          AND e.campaign_id = ?
          AND e.deleted_at IS NULL
        GROUP BY e.id
        ORDER BY e.name ASC
      `).all(entityType.id, campaignId) as LocationRow[]

      // Step 2: Apply Levenshtein distance for better ranking
      let scoredLocations = locations.map((location: LocationRow): ScoredLocation => {
        const nameNormalized = normalizeText(location.name)

        // Smart distance calculation
        const exactMatch = nameNormalized === searchTerm
        const startsWithQuery = nameNormalized.startsWith(searchTerm)
        const containsQuery = nameNormalized.includes(searchTerm)

        // Check if search term appears in metadata, description, or linked entities (FTS5 match but not in name)
        const metadataNormalized = normalizeText(location.metadata || '')
        const descriptionNormalized = normalizeText(location.description || '')
        const linkedNpcNamesNormalized = normalizeText(location.linked_npc_names || '')
        const linkedItemNamesNormalized = normalizeText(location.linked_item_names || '')
        const isMetadataMatch = metadataNormalized.includes(searchTerm)
        const isDescriptionMatch = descriptionNormalized.includes(searchTerm)
        const isNpcMatch = linkedNpcNamesNormalized.includes(searchTerm)
        const isItemMatch = linkedItemNamesNormalized.includes(searchTerm)
        const isNonNameMatch = (isMetadataMatch || isDescriptionMatch || isNpcMatch || isItemMatch) && !containsQuery

        let levDistance: number

        if (isNonNameMatch) {
          // Metadata/Description match: Set distance to 0 (perfect match conceptually)
          levDistance = 0
        }
        else if (startsWithQuery) {
          // If name starts with query, distance is just the remaining chars
          levDistance = nameNormalized.length - searchTerm.length
        }
        else {
          // Full Levenshtein distance for non-prefix matches
          levDistance = levenshtein(searchTerm, nameNormalized)
        }

        // Combined score: FTS score + weighted Levenshtein distance
        const ftsScore = location.fts_score ?? 0
        let finalScore = ftsScore + (levDistance * 0.5)

        // Apply bonuses (reduce score = better ranking)
        if (exactMatch) finalScore -= 1000
        if (startsWithQuery) finalScore -= 100
        if (containsQuery) finalScore -= 50
        if (isNpcMatch) finalScore -= 30 // NPC matches are very good
        if (isItemMatch) finalScore -= 30 // Item matches are very good
        if (isMetadataMatch) finalScore -= 25 // Metadata matches are good
        if (isDescriptionMatch) finalScore -= 10 // Description matches are ok

        return {
          ...location,
          _lev_distance: levDistance,
          _final_score: finalScore,
        }
      })

      // Step 3: Filter by Levenshtein distance
      if (!parsedQuery.hasOperators) {
        // Simple query: check if ANY term matches
        scoredLocations = scoredLocations.filter(location => {
          const nameNormalized = normalizeText(location.name)
          const metadataNormalized = normalizeText(location.metadata || '')
          const descriptionNormalized = normalizeText(location.description || '')
          const linkedNpcNamesNormalized = normalizeText(location.linked_npc_names || '')
          const linkedItemNamesNormalized = normalizeText(location.linked_item_names || '')

          // Check ALL terms
          for (const term of parsedQuery.terms) {
            // Exact/substring match in any field
            if (nameNormalized.includes(term) || descriptionNormalized.includes(term) || metadataNormalized.includes(term) || linkedNpcNamesNormalized.includes(term) || linkedItemNamesNormalized.includes(term)) {
              return true
            }

            // Prefix match (before Levenshtein for performance)
            if (nameNormalized.startsWith(term)) {
              return true
            }

            // Levenshtein match for name and description (check against each word)
            const termLength = term.length
            const maxDist = termLength <= 3 ? 2 : termLength <= 6 ? 3 : 4

            // Split name into words and check each
            const nameWords = nameNormalized.split(/\s+/)
            for (const word of nameWords) {
              if (word.length === 0) continue
              const levDist = levenshtein(term, word)
              if (levDist <= maxDist) {
                return true
              }
            }

            // Also check description words for fuzzy matching
            if (descriptionNormalized.length > 0) {
              const descWords = descriptionNormalized.split(/\s+/)
              for (const word of descWords) {
                if (word.length < 3) continue // Skip very short words
                const levDist = levenshtein(term, word)
                if (levDist <= maxDist) {
                  return true
                }
              }
            }

            // Levenshtein match for linked NPC names (split by comma, then by words)
            if (linkedNpcNamesNormalized.length > 0) {
              const npcNames = linkedNpcNamesNormalized.split(',').map(n => n.trim())
              for (const npcName of npcNames) {
                if (npcName.length === 0) continue
                // Split each NPC name into words (e.g., "Günther Müller" → ["günther", "müller"])
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

            // Levenshtein match for linked Item names (split by comma, then by words)
            if (linkedItemNamesNormalized.length > 0) {
              const itemNames = linkedItemNamesNormalized.split(',').map(n => n.trim())
              for (const itemName of itemNames) {
                if (itemName.length === 0) continue
                // Split each item name into words
                const itemWords = itemName.split(/\s+/)
                for (const word of itemWords) {
                  if (word.length === 0) continue
                  const itemLevDist = levenshtein(term, word)
                  if (itemLevDist <= maxDist) {
                    return true
                  }
                }
              }
            }
          }

          return false // No term matched
        })
      }
      else if (hasOrOperator && !hasAndOperator) {
        // OR query: at least ONE term must match
        scoredLocations = scoredLocations.filter(location => {
          const nameNormalized = normalizeText(location.name)
          const metadataNormalized = normalizeText(location.metadata || '')
          const descriptionNormalized = normalizeText(location.description || '')
          const linkedNpcNamesNormalized = normalizeText(location.linked_npc_names || '')
          const linkedItemNamesNormalized = normalizeText(location.linked_item_names || '')

          // Check if at least one term matches
          for (const term of parsedQuery.terms) {
            // Check if term appears in any field
            if (nameNormalized.includes(term) || descriptionNormalized.includes(term) || metadataNormalized.includes(term) || linkedNpcNamesNormalized.includes(term) || linkedItemNamesNormalized.includes(term)) {
              return true
            }

            // Prefix match (before Levenshtein for performance)
            if (nameNormalized.startsWith(term)) {
              return true
            }

            // Check Levenshtein for name and description (check against each word)
            const termLength = term.length
            const maxDist = termLength <= 3 ? 2 : termLength <= 6 ? 3 : 4

            // Split name into words and check each
            const nameWords = nameNormalized.split(/\s+/)
            for (const word of nameWords) {
              if (word.length === 0) continue
              const levDist = levenshtein(term, word)
              if (levDist <= maxDist) {
                return true // Close enough match
              }
            }

            // Also check description words for fuzzy matching
            if (descriptionNormalized.length > 0) {
              const descWords = descriptionNormalized.split(/\s+/)
              for (const word of descWords) {
                if (word.length < 3) continue // Skip very short words
                const levDist = levenshtein(term, word)
                if (levDist <= maxDist) {
                  return true
                }
              }
            }

            // Check Levenshtein for linked NPC names (split by comma, then by words)
            if (linkedNpcNamesNormalized.length > 0) {
              const npcNames = linkedNpcNamesNormalized.split(',').map(n => n.trim())
              for (const npcName of npcNames) {
                if (npcName.length === 0) continue
                // Split each NPC name into words
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

            // Check Levenshtein for linked Item names (split by comma, then by words)
            if (linkedItemNamesNormalized.length > 0) {
              const itemNames = linkedItemNamesNormalized.split(',').map(n => n.trim())
              for (const itemName of itemNames) {
                if (itemName.length === 0) continue
                // Split each item name into words
                const itemWords = itemName.split(/\s+/)
                for (const word of itemWords) {
                  if (word.length === 0) continue
                  const itemLevDist = levenshtein(term, word)
                  if (itemLevDist <= maxDist) {
                    return true
                  }
                }
              }
            }
          }
          return false // No term matched
        })
      }
      else if (hasAndOperator) {
        // AND query: ALL terms must match
        scoredLocations = scoredLocations.filter(location => {
          const nameNormalized = normalizeText(location.name)
          const metadataNormalized = normalizeText(location.metadata || '')
          const descriptionNormalized = normalizeText(location.description || '')
          const linkedNpcNamesNormalized = normalizeText(location.linked_npc_names || '')
          const linkedItemNamesNormalized = normalizeText(location.linked_item_names || '')

          // Check if ALL terms match
          for (const term of parsedQuery.terms) {
            let termMatches = false

            // Check if term appears in any field
            if (nameNormalized.includes(term) || descriptionNormalized.includes(term) || metadataNormalized.includes(term) || linkedNpcNamesNormalized.includes(term) || linkedItemNamesNormalized.includes(term)) {
              termMatches = true
            }

            // Prefix match (before Levenshtein for performance)
            if (!termMatches && nameNormalized.startsWith(term)) {
              termMatches = true
            }

            // Check Levenshtein for name and description (check against each word)
            if (!termMatches) {
              const termLength = term.length
              const maxDist = termLength <= 3 ? 2 : termLength <= 6 ? 3 : 4

              // Split name into words and check each
              const nameWords = nameNormalized.split(/\s+/)
              for (const word of nameWords) {
                if (word.length === 0) continue
                const levDist = levenshtein(term, word)
                if (levDist <= maxDist) {
                  termMatches = true
                  break
                }
              }

              // Also check description words for fuzzy matching
              if (!termMatches && descriptionNormalized.length > 0) {
                const descWords = descriptionNormalized.split(/\s+/)
                for (const word of descWords) {
                  if (word.length < 3) continue // Skip very short words
                  const levDist = levenshtein(term, word)
                  if (levDist <= maxDist) {
                    termMatches = true
                    break
                  }
                }
              }
            }

            // Check Levenshtein for linked NPC names (split by comma, then by words)
            if (!termMatches && linkedNpcNamesNormalized.length > 0) {
              const termLength = term.length
              const maxDist = termLength <= 3 ? 2 : termLength <= 6 ? 3 : 4
              const npcNames = linkedNpcNamesNormalized.split(',').map(n => n.trim())

              for (const npcName of npcNames) {
                if (npcName.length === 0) continue
                // Split each NPC name into words
                const npcWords = npcName.split(/\s+/)
                for (const word of npcWords) {
                  if (word.length === 0) continue
                  const npcLevDist = levenshtein(term, word)
                  if (npcLevDist <= maxDist) {
                    termMatches = true
                    break
                  }
                }
                if (termMatches) break
              }
            }

            // Check Levenshtein for linked Item names (split by comma, then by words)
            if (!termMatches && linkedItemNamesNormalized.length > 0) {
              const termLength = term.length
              const maxDist = termLength <= 3 ? 2 : termLength <= 6 ? 3 : 4
              const itemNames = linkedItemNamesNormalized.split(',').map(n => n.trim())

              for (const itemName of itemNames) {
                if (itemName.length === 0) continue
                // Split each item name into words
                const itemWords = itemName.split(/\s+/)
                for (const word of itemWords) {
                  if (word.length === 0) continue
                  const itemLevDist = levenshtein(term, word)
                  if (itemLevDist <= maxDist) {
                    termMatches = true
                    break
                  }
                }
                if (termMatches) break
              }
            }

            // If this term doesn't match, reject the location
            if (!termMatches) {
              return false
            }
          }

          // All terms matched!
          return true
        })
      }

      // Step 4: Sort by combined score and take top 50
      scoredLocations.sort((a, b) => a._final_score - b._final_score)
      scoredLocations = scoredLocations.slice(0, 50)

      // Clean up scoring metadata
      locations = scoredLocations.map(({ fts_score, _lev_distance, _final_score, ...location }) => location)
    }
    catch (error) {
      // Fallback: If FTS5 fails, return empty (better than crashing)
      console.error('[Location Search] FTS5 search failed:', error)
      locations = []
    }
  }
  else {
    // No search query - return all locations for this campaign
    locations = db.prepare(`
      SELECT
        e.id,
        e.name,
        e.description,
        e.image_url,
        e.metadata,
        e.created_at,
        e.updated_at,
        ei.image_url as primary_image_url,
        GROUP_CONCAT(DISTINCT npc.name) as linked_npc_names,
        GROUP_CONCAT(DISTINCT item.name) as linked_item_names
      FROM entities e
      LEFT JOIN entity_images ei ON e.id = ei.entity_id AND ei.is_primary = 1
      LEFT JOIN entity_relations npc_rel ON npc_rel.to_entity_id = e.id
      LEFT JOIN entities npc ON npc.id = npc_rel.from_entity_id AND npc.deleted_at IS NULL AND npc.type_id = (SELECT id FROM entity_types WHERE name = 'NPC')
      LEFT JOIN entity_relations item_rel ON item_rel.to_entity_id = e.id
      LEFT JOIN entities item ON item.id = item_rel.from_entity_id AND item.deleted_at IS NULL AND item.type_id = (SELECT id FROM entity_types WHERE name = 'Item')
      WHERE e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
      GROUP BY e.id
      ORDER BY e.name ASC
    `).all(entityType.id, campaignId) as LocationRow[]
  }

  // Parse metadata JSON
  return locations.map(location => ({
    ...location,
    image_url: location.primary_image_url || location.image_url, // Fallback to old image_url
    metadata: location.metadata ? JSON.parse(location.metadata as string) : null,
  }))
})
