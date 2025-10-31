import { getDb } from '../../utils/db'
import { createLevenshtein } from '../../utils/levenshtein'
import { parseSearchQuery } from '../../utils/search-query-parser'

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

  // Get Faction entity type ID
  const entityType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Faction') as { id: number } | undefined

  if (!entityType) {
    return []
  }

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
  }

  interface ScoredFaction extends FactionRow {
    _lev_distance: number
    _final_score: number
  }

  let factions: FactionRow[]

  // HYBRID APPROACH: FTS5 pre-filter + Levenshtein ranking
  if (searchQuery && searchQuery.trim().length > 0) {
    const searchTerm = searchQuery.trim().toLowerCase()

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
      factions = db.prepare(`
        SELECT
          e.id,
          e.name,
          e.description,
          e.image_url,
          e.metadata,
          e.created_at,
          e.updated_at,
          bm25(entities_fts, 10.0, 1.0, 0.5) as fts_score,
          leader_rel.from_entity_id as leader_id,
          leader_npc.name as leader_name
        FROM entities_fts fts
        INNER JOIN entities e ON fts.rowid = e.id
        LEFT JOIN entity_relations leader_rel ON leader_rel.to_entity_id = e.id AND leader_rel.relation_type = 'Anführer'
        LEFT JOIN entities leader_npc ON leader_npc.id = leader_rel.from_entity_id AND leader_npc.deleted_at IS NULL
        WHERE entities_fts MATCH ?
          AND e.type_id = ?
          AND e.campaign_id = ?
          AND e.deleted_at IS NULL
        ORDER BY fts_score
        LIMIT 100
      `).all(ftsQuery, entityType.id, campaignId) as FactionRow[]

      // FALLBACK 1: Try prefix wildcard if exact match found nothing (only for simple queries)
      if (factions.length === 0 && useExactMatch && !parsedQuery.hasOperators) {
        ftsQuery = `${searchTerm}*`
        useExactMatch = false

        factions = db.prepare(`
          SELECT
            e.id,
            e.name,
            e.description,
            e.image_url,
            e.metadata,
            e.created_at,
            e.updated_at,
            bm25(entities_fts, 10.0, 1.0, 0.5) as fts_score,
            leader_rel.from_entity_id as leader_id,
            leader_npc.name as leader_name
          FROM entities_fts fts
          INNER JOIN entities e ON fts.rowid = e.id
          LEFT JOIN entity_relations leader_rel ON leader_rel.to_entity_id = e.id AND leader_rel.relation_type = 'Anführer'
          LEFT JOIN entities leader_npc ON leader_npc.id = leader_rel.from_entity_id AND leader_npc.deleted_at IS NULL
          WHERE entities_fts MATCH ?
            AND e.type_id = ?
            AND e.campaign_id = ?
            AND e.deleted_at IS NULL
          ORDER BY fts_score
          LIMIT 100
        `).all(ftsQuery, entityType.id, campaignId) as FactionRow[]
      }

      // FALLBACK 2: For operator queries or when FTS5 returns nothing, use full table scan with Levenshtein
      const hasOrOperator = parsedQuery.fts5Query.toUpperCase().includes(' OR ')
      const hasAndOperator = parsedQuery.fts5Query.toUpperCase().includes(' AND ')

      if (parsedQuery.hasOperators || factions.length === 0) {
        factions = db.prepare(`
          SELECT
            e.id,
            e.name,
            e.description,
            e.image_url,
            e.metadata,
            e.created_at,
            e.updated_at,
            leader_rel.from_entity_id as leader_id,
            leader_npc.name as leader_name
          FROM entities e
          LEFT JOIN entity_relations leader_rel ON leader_rel.to_entity_id = e.id AND leader_rel.relation_type = 'Anführer'
          LEFT JOIN entities leader_npc ON leader_npc.id = leader_rel.from_entity_id AND leader_npc.deleted_at IS NULL
          WHERE e.type_id = ?
            AND e.campaign_id = ?
            AND e.deleted_at IS NULL
          ORDER BY e.name ASC
        `).all(entityType.id, campaignId) as FactionRow[]
      }

      // Step 2: Apply Levenshtein distance for better ranking
      let scoredFactions = factions.map((faction: FactionRow): ScoredFaction => {
        const nameLower = faction.name.toLowerCase()

        // Smart distance calculation
        const exactMatch = nameLower === searchTerm
        const startsWithQuery = nameLower.startsWith(searchTerm)
        const containsQuery = nameLower.includes(searchTerm)

        // Check if search term appears in metadata, description, or leader name (FTS5 match but not in name)
        const metadataLower = faction.metadata?.toLowerCase() || ''
        const descriptionLower = (faction.description || '').toLowerCase()
        const leaderNameLower = (faction.leader_name || '').toLowerCase()
        const isMetadataMatch = metadataLower.includes(searchTerm)
        const isDescriptionMatch = descriptionLower.includes(searchTerm)
        const isLeaderMatch = leaderNameLower.includes(searchTerm)
        const isNonNameMatch = (isMetadataMatch || isDescriptionMatch || isLeaderMatch) && !containsQuery

        let levDistance: number

        if (isNonNameMatch) {
          // Metadata/Description match: Set distance to 0 (perfect match conceptually)
          levDistance = 0
        }
        else if (startsWithQuery) {
          // If name starts with query, distance is just the remaining chars
          levDistance = nameLower.length - searchTerm.length
        }
        else {
          // Full Levenshtein distance for non-prefix matches
          levDistance = levenshtein(searchTerm, nameLower)
        }

        // Combined score: FTS score + weighted Levenshtein distance
        const ftsScore = faction.fts_score ?? 0
        let finalScore = ftsScore + (levDistance * 0.5)

        // Apply bonuses (reduce score = better ranking)
        if (exactMatch) finalScore -= 1000
        if (startsWithQuery) finalScore -= 100
        if (containsQuery) finalScore -= 50
        if (isLeaderMatch) finalScore -= 30 // Leader name matches are very good
        if (isMetadataMatch) finalScore -= 25 // Metadata matches are good
        if (isDescriptionMatch) finalScore -= 10 // Description matches are ok

        return {
          ...faction,
          _lev_distance: levDistance,
          _final_score: finalScore,
        }
      })

      // Step 3: Filter by Levenshtein distance
      if (!parsedQuery.hasOperators) {
        // Simple query: check if ANY term matches
        scoredFactions = scoredFactions.filter(faction => {
          const nameLower = faction.name.toLowerCase()
          const metadataLower = faction.metadata?.toLowerCase() || ''
          const descriptionLower = (faction.description || '').toLowerCase()
          const leaderNameLower = (faction.leader_name || '').toLowerCase()

          // Check ALL terms
          for (const term of parsedQuery.terms) {
            // Exact/substring match in any field
            if (nameLower.includes(term) || descriptionLower.includes(term) || metadataLower.includes(term) || leaderNameLower.includes(term)) {
              return true
            }

            // Levenshtein match for name
            const termLength = term.length
            const maxDist = termLength <= 3 ? 2 : termLength <= 6 ? 3 : 4
            const levDist = levenshtein(term, nameLower)

            if (levDist <= maxDist) {
              return true
            }

            // Prefix match
            if (nameLower.startsWith(term)) {
              return true
            }
          }

          return false // No term matched
        })
      }
      else if (hasOrOperator && !hasAndOperator) {
        // OR query: at least ONE term must match
        scoredFactions = scoredFactions.filter(faction => {
          const nameLower = faction.name.toLowerCase()
          const metadataLower = faction.metadata?.toLowerCase() || ''
          const descriptionLower = (faction.description || '').toLowerCase()
          const leaderNameLower = (faction.leader_name || '').toLowerCase()

          // Check if at least one term matches
          for (const term of parsedQuery.terms) {
            // Check if term appears in any field
            if (nameLower.includes(term) || descriptionLower.includes(term) || metadataLower.includes(term) || leaderNameLower.includes(term)) {
              return true
            }

            // Check Levenshtein for name
            const termLength = term.length
            const maxDist = termLength <= 3 ? 2 : termLength <= 6 ? 3 : 4
            const levDist = levenshtein(term, nameLower)

            if (levDist <= maxDist) {
              return true // Close enough match
            }
          }
          return false // No term matched
        })
      }
      else if (hasAndOperator) {
        // AND query: ALL terms must match
        scoredFactions = scoredFactions.filter(faction => {
          const nameLower = faction.name.toLowerCase()
          const metadataLower = faction.metadata?.toLowerCase() || ''
          const descriptionLower = (faction.description || '').toLowerCase()
          const leaderNameLower = (faction.leader_name || '').toLowerCase()

          // Check if ALL terms match
          for (const term of parsedQuery.terms) {
            let termMatches = false

            // Check if term appears in any field
            if (nameLower.includes(term) || descriptionLower.includes(term) || metadataLower.includes(term) || leaderNameLower.includes(term)) {
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
      factions = scoredFactions.map(({ fts_score, _lev_distance, _final_score, ...faction }) => faction)
    }
    catch (error) {
      // Fallback: If FTS5 fails, return empty (better than crashing)
      console.error('[Faction Search] FTS5 search failed:', error)
      factions = []
    }
  }
  else {
    // No search query - return all factions for this campaign
    factions = db.prepare(`
      SELECT
        e.id,
        e.name,
        e.description,
        e.image_url,
        e.metadata,
        e.created_at,
        e.updated_at,
        leader_rel.from_entity_id as leader_id,
        leader_npc.name as leader_name
      FROM entities e
      LEFT JOIN entity_relations leader_rel ON leader_rel.to_entity_id = e.id AND leader_rel.relation_type = 'Anführer'
      LEFT JOIN entities leader_npc ON leader_npc.id = leader_rel.from_entity_id AND leader_npc.deleted_at IS NULL
      WHERE e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
      ORDER BY e.name ASC
    `).all(entityType.id, campaignId) as FactionRow[]
  }

  // Parse metadata JSON
  return factions.map(faction => ({
    ...faction,
    metadata: faction.metadata ? JSON.parse(faction.metadata as string) : null,
  }))
})
