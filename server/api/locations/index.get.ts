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
  }

  interface ScoredLocation extends LocationRow {
    _lev_distance: number
    _final_score: number
  }

  let locations: LocationRow[]

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
          bm25(entities_fts, 10.0, 1.0, 0.5) as fts_score
        FROM entities_fts fts
        INNER JOIN entities e ON fts.rowid = e.id
        LEFT JOIN entity_images ei ON e.id = ei.entity_id AND ei.is_primary = 1
        WHERE entities_fts MATCH ?
          AND e.type_id = ?
          AND e.campaign_id = ?
          AND e.deleted_at IS NULL
        ORDER BY fts_score
        LIMIT 100
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
            bm25(entities_fts, 10.0, 1.0, 0.5) as fts_score
          FROM entities_fts fts
          INNER JOIN entities e ON fts.rowid = e.id
          LEFT JOIN entity_images ei ON e.id = ei.entity_id AND ei.is_primary = 1
          WHERE entities_fts MATCH ?
            AND e.type_id = ?
            AND e.campaign_id = ?
            AND e.deleted_at IS NULL
          ORDER BY fts_score
          LIMIT 100
        `).all(ftsQuery, entityType.id, campaignId) as LocationRow[]
      }

      // FALLBACK 2: For operator queries or when FTS5 returns nothing, use full table scan with Levenshtein
      const hasOrOperator = parsedQuery.fts5Query.toUpperCase().includes(' OR ')
      const hasAndOperator = parsedQuery.fts5Query.toUpperCase().includes(' AND ')

      if (parsedQuery.hasOperators || locations.length === 0) {
        locations = db.prepare(`
          SELECT
            e.id,
            e.name,
            e.description,
            e.image_url,
            e.metadata,
            e.created_at,
            e.updated_at,
            ei.image_url as primary_image_url
          FROM entities e
          LEFT JOIN entity_images ei ON e.id = ei.entity_id AND ei.is_primary = 1
          WHERE e.type_id = ?
            AND e.campaign_id = ?
            AND e.deleted_at IS NULL
          ORDER BY e.name ASC
        `).all(entityType.id, campaignId) as LocationRow[]
      }

      // Step 2: Apply Levenshtein distance for better ranking
      let scoredLocations = locations.map((location: LocationRow): ScoredLocation => {
        const nameLower = location.name.toLowerCase()

        // Smart distance calculation
        const exactMatch = nameLower === searchTerm
        const startsWithQuery = nameLower.startsWith(searchTerm)
        const containsQuery = nameLower.includes(searchTerm)

        // Check if search term appears in metadata or description (FTS5 match but not in name)
        const metadataLower = location.metadata?.toLowerCase() || ''
        const descriptionLower = (location.description || '').toLowerCase()
        const isMetadataMatch = metadataLower.includes(searchTerm)
        const isDescriptionMatch = descriptionLower.includes(searchTerm)
        const isNonNameMatch = (isMetadataMatch || isDescriptionMatch) && !containsQuery

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
        const ftsScore = location.fts_score ?? 0
        let finalScore = ftsScore + (levDistance * 0.5)

        // Apply bonuses (reduce score = better ranking)
        if (exactMatch) finalScore -= 1000
        if (startsWithQuery) finalScore -= 100
        if (containsQuery) finalScore -= 50
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
          const nameLower = location.name.toLowerCase()
          const metadataLower = location.metadata?.toLowerCase() || ''
          const descriptionLower = (location.description || '').toLowerCase()

          // Check ALL terms
          for (const term of parsedQuery.terms) {
            // Exact/substring match in any field
            if (nameLower.includes(term) || descriptionLower.includes(term) || metadataLower.includes(term)) {
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
        scoredLocations = scoredLocations.filter(location => {
          const nameLower = location.name.toLowerCase()
          const metadataLower = location.metadata?.toLowerCase() || ''
          const descriptionLower = (location.description || '').toLowerCase()

          // Check if at least one term matches
          for (const term of parsedQuery.terms) {
            // Check if term appears in any field
            if (nameLower.includes(term) || descriptionLower.includes(term) || metadataLower.includes(term)) {
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
        scoredLocations = scoredLocations.filter(location => {
          const nameLower = location.name.toLowerCase()
          const metadataLower = location.metadata?.toLowerCase() || ''
          const descriptionLower = (location.description || '').toLowerCase()

          // Check if ALL terms match
          for (const term of parsedQuery.terms) {
            let termMatches = false

            // Check if term appears in any field
            if (nameLower.includes(term) || descriptionLower.includes(term) || metadataLower.includes(term)) {
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
        ei.image_url as primary_image_url
      FROM entities e
      LEFT JOIN entity_images ei ON e.id = ei.entity_id AND ei.is_primary = 1
      WHERE e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
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
