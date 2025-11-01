import { getDb } from '../../utils/db'
import { createLevenshtein } from '../../utils/levenshtein'
import { parseSearchQuery } from '../../utils/search-query-parser'
import { getRaceKey, getClassKey, getLocaleFromEvent } from '../../utils/i18n-lookup'
import { normalizeText } from '../../utils/normalize'

// Initialize Levenshtein function once
const levenshtein = createLevenshtein()

export default defineEventHandler((event) => {
  const db = getDb()
  const query = getQuery(event)
  const campaignId = query.campaignId as string
  const searchQuery = query.search as string | undefined

  // Get user's locale from request (cookie or Accept-Language header)
  const locale = getLocaleFromEvent(event)

  if (!campaignId) {
    throw createError({
      statusCode: 400,
      message: 'Campaign ID is required',
    })
  }

  // Get NPC entity type ID
  const entityType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as { id: number } | undefined

  if (!entityType) {
    return []
  }

  interface NpcRow {
    id: number
    name: string
    description: string | null
    image_url: string | null
    metadata: string | null
    created_at: string
    updated_at: string
    fts_score?: number
  }

  interface ScoredNpc extends NpcRow {
    _lev_distance: number
    _final_score: number
  }

  let npcs: NpcRow[]

  // HYBRID APPROACH: FTS5 pre-filter + Levenshtein ranking
  if (searchQuery && searchQuery.trim().length > 0) {
    const searchTerm = normalizeText(searchQuery.trim())

    // Parse query with operators (AND, OR, NOT)
    const parsedQuery = parseSearchQuery(searchTerm)

    // Expand all terms with race/class key lookups (locale-aware)
    // E.g., "mensch" (DE) → also search for "human" key
    // E.g., "mensh" (DE typo) → also search for "human" key (fuzzy match)
    // E.g., "human" (EN) → also search for "human" key
    // E.g., "humen" (EN typo) → also search for "human" key (fuzzy match)
    const expandedTerms = parsedQuery.terms.map(term => {
      // Only enable fuzzy matching for longer terms (>= 5 chars) to avoid false matches
      // e.g., "bern" should NOT match "barde" (class), but "hexen" should match "hexenmeister"
      const enableFuzzy = term.length >= 5
      const raceKey = getRaceKey(term, enableFuzzy, locale)
      const classKey = getClassKey(term, enableFuzzy, locale)

      // If we found a race/class key, ONLY use the key (not the original term)
      // This prevents "human" (a key) from matching in DE when it shouldn't
      if (raceKey) {
        return { variants: [raceKey], isRaceClassKey: true }
      }
      if (classKey) {
        return { variants: [classKey], isRaceClassKey: true }
      }

      // No race/class match - use original term (e.g., NPC name search)
      // But check if term might be a key in OTHER locale (block cross-language matching)
      const isKeyInOtherLocale = getRaceKey(term, false, locale === 'de' ? 'en' : 'de') !== null
        || getClassKey(term, false, locale === 'de' ? 'en' : 'de') !== null

      return { variants: [term], isRaceClassKey: false, blockMetadata: isKeyInOtherLocale }
    })

    // Rebuild FTS query with expanded terms
    let ftsQuery: string
    if (parsedQuery.hasOperators) {
      // For operator queries, expand each term: "bernard AND mensch" → "(bernard*) AND (mensch* OR human*)"
      const expandedFtsTerms = expandedTerms.map(termObj => {
        const keys = termObj.variants
        if (keys.length === 1) {
          return `${keys[0]}*`
        }
        else {
          return `(${keys.map(k => `${k}*`).join(' OR ')})`
        }
      })

      // Reconstruct query with original operators
      const fts5QueryUpper = parsedQuery.fts5Query.toUpperCase()
      if (fts5QueryUpper.includes(' AND ')) {
        ftsQuery = expandedFtsTerms.join(' AND ')
      }
      else if (fts5QueryUpper.includes(' OR ')) {
        ftsQuery = expandedFtsTerms.join(' OR ')
      }
      else {
        ftsQuery = expandedFtsTerms.join(' ')
      }
    }
    else {
      // Simple query: add all keys as OR
      const allKeys = expandedTerms.flatMap(termObj => termObj.variants)
      ftsQuery = allKeys.map(k => `${k}*`).join(' OR ')
    }

    let useExactMatch = parsedQuery.useExactFirst

    try {
      // Step 1: FTS5 pre-filter (fast, gets ~100 candidates)
      npcs = db.prepare(`
        SELECT
          e.id,
          e.name,
          e.description,
          e.image_url,
          e.metadata,
          e.created_at,
          e.updated_at,
          bm25(entities_fts, 10.0, 1.0, 0.5) as fts_score
        FROM entities_fts fts
        INNER JOIN entities e ON fts.rowid = e.id
        WHERE entities_fts MATCH ?
          AND e.type_id = ?
          AND e.campaign_id = ?
          AND e.deleted_at IS NULL
        ORDER BY fts_score
        LIMIT 100
      `).all(ftsQuery, entityType.id, campaignId) as NpcRow[]
      console.log('[NPC Search] FTS5 returned:', npcs.length, 'candidates')

      // FALLBACK 1: Try prefix wildcard if exact match found nothing (only for simple queries)
      if (npcs.length === 0 && useExactMatch && !parsedQuery.hasOperators) {
        ftsQuery = `${searchTerm}*`
        useExactMatch = false

        npcs = db.prepare(`
          SELECT
            e.id,
            e.name,
            e.description,
            e.image_url,
            e.metadata,
            e.created_at,
            e.updated_at,
            bm25(entities_fts, 10.0, 1.0, 0.5) as fts_score
          FROM entities_fts fts
          INNER JOIN entities e ON fts.rowid = e.id
          WHERE entities_fts MATCH ?
            AND e.type_id = ?
            AND e.campaign_id = ?
            AND e.deleted_at IS NULL
          ORDER BY fts_score
          LIMIT 100
        `).all(ftsQuery, entityType.id, campaignId) as NpcRow[]
      }

      // FALLBACK 2: Decide based on operator type
      const hasOrOperator = parsedQuery.fts5Query.toUpperCase().includes(' OR ')
      const hasAndOperator = parsedQuery.fts5Query.toUpperCase().includes(' AND ')

      // For operator queries (AND/OR): ALWAYS use Levenshtein fallback
      // This ensures we catch typos in ALL terms
      if (parsedQuery.hasOperators) {
        npcs = db.prepare(`
          SELECT
            e.id,
            e.name,
            e.description,
            e.image_url,
            e.metadata,
            e.created_at,
            e.updated_at
          FROM entities e
          WHERE e.type_id = ?
            AND e.campaign_id = ?
            AND e.deleted_at IS NULL
          ORDER BY e.name ASC
        `).all(entityType.id, campaignId) as NpcRow[]
      }
      // For simple queries with no FTS5 results
      else if (npcs.length === 0) {
        npcs = db.prepare(`
          SELECT
            e.id,
            e.name,
            e.description,
            e.image_url,
            e.metadata,
            e.created_at,
            e.updated_at
          FROM entities e
          WHERE e.type_id = ?
            AND e.campaign_id = ?
            AND e.deleted_at IS NULL
          ORDER BY e.name ASC
        `).all(entityType.id, campaignId) as NpcRow[]
      }

      // Step 2: Apply Levenshtein distance for better ranking
      let scoredNpcs = npcs.map((npc: NpcRow): ScoredNpc => {
        const nameNormalized = normalizeText(npc.name)

        // Smart distance calculation
        const exactMatch = nameNormalized === searchTerm
        const startsWithQuery = nameNormalized.startsWith(searchTerm)
        const containsQuery = nameNormalized.includes(searchTerm)

        // Check if search term appears in metadata or description (FTS5 match but not in name)
        const metadataNormalized = normalizeText(npc.metadata || '')
        const descriptionNormalized = normalizeText(npc.description || '')
        const isMetadataMatch = metadataNormalized.includes(searchTerm)
        const isDescriptionMatch = descriptionNormalized.includes(searchTerm)
        const isNonNameMatch = (isMetadataMatch || isDescriptionMatch) && !containsQuery

        let levDistance: number

        if (isNonNameMatch) {
          // Metadata/Description match: Set distance to 0 (perfect match conceptually)
          levDistance = 0
        }
        else if (startsWithQuery) {
          // If name starts with query, distance is just the remaining chars
          // "bern" vs "bernhard" → distance = 4 (remaining: "hard")
          levDistance = nameNormalized.length - searchTerm.length
        }
        else {
          // Full Levenshtein distance for non-prefix matches
          levDistance = levenshtein(searchTerm, nameNormalized)
        }

        // Combined score: FTS score + weighted Levenshtein distance
        const ftsScore = npc.fts_score ?? 0
        let finalScore = ftsScore + (levDistance * 0.5)

        // Apply bonuses (reduce score = better ranking)
        if (exactMatch) finalScore -= 1000
        if (startsWithQuery) finalScore -= 100
        if (containsQuery) finalScore -= 50
        if (isMetadataMatch) finalScore -= 25 // Metadata matches are good
        if (isDescriptionMatch) finalScore -= 10 // Description matches are ok

        return {
          ...npc,
          _lev_distance: levDistance,
          _final_score: finalScore,
        }
      })

      // Step 3: Filter by Levenshtein distance
      if (!parsedQuery.hasOperators) {
        // Simple query: check if ANY expanded term matches
        scoredNpcs = scoredNpcs.filter(npc => {
          const nameNormalized = normalizeText(npc.name)
          const metadataNormalized = normalizeText(npc.metadata || '')
          const descriptionNormalized = normalizeText(npc.description || '')

          // Check ALL expanded terms (original + race/class keys)
          for (const termObj of expandedTerms) {
            for (const variant of termObj.variants) {
              // Check metadata ONLY if not blocked (prevents cross-language key matching)
              const shouldCheckMetadata = !termObj.blockMetadata

              // Exact/substring match in any field
              if (nameNormalized.includes(variant) || descriptionNormalized.includes(variant)) {
                return true
              }

              // Check metadata only if allowed
              if (shouldCheckMetadata && metadataNormalized.includes(variant)) {
                return true
              }

              // Prefix match (before Levenshtein for performance)
              if (nameNormalized.startsWith(variant)) {
                return true
              }

              // Levenshtein match for name
              const variantLength = variant.length
              const maxDist = variantLength <= 3 ? 2 : variantLength <= 6 ? 3 : 4
              const levDist = levenshtein(variant, nameNormalized)

              if (levDist <= maxDist) {
                return true
              }
            }
          }

          return false // No variant matched
        })
      }
      else if (hasOrOperator && !hasAndOperator) {
        // OR query: at least ONE term must match
        scoredNpcs = scoredNpcs.filter(npc => {
          const nameNormalized = normalizeText(npc.name)
          const metadataNormalized = normalizeText(npc.metadata || '')
          const descriptionNormalized = normalizeText(npc.description || '')

          // Check if at least one term (or its variants) matches
          for (let i = 0; i < parsedQuery.terms.length; i++) {
            const termObj = expandedTerms[i]
            const shouldCheckMetadata = !termObj.blockMetadata

            // Check if ANY variant matches
            for (const variant of termObj.variants) {
              // Check if variant appears in any field
              if (nameNormalized.includes(variant) || descriptionNormalized.includes(variant)) {
                return true // At least one variant matches
              }

              // Check metadata only if allowed
              if (shouldCheckMetadata && metadataNormalized.includes(variant)) {
                return true
              }

              // Prefix match (before Levenshtein for performance)
              if (nameNormalized.startsWith(variant)) {
                return true
              }

              // Check Levenshtein for name
              const variantLength = variant.length
              const maxDist = variantLength <= 3 ? 2 : variantLength <= 6 ? 3 : 4
              const levDist = levenshtein(variant, nameNormalized)

              if (levDist <= maxDist) {
                return true // Close enough match
              }
            }
          }
          return false // No term matched
        })
      }
      else if (hasAndOperator) {
        // AND query: ALL terms must match
        scoredNpcs = scoredNpcs.filter(npc => {
          const nameNormalized = normalizeText(npc.name)
          const metadataNormalized = normalizeText(npc.metadata || '')
          const descriptionNormalized = normalizeText(npc.description || '')

          // Check if ALL terms (or their expanded keys) match
          for (let i = 0; i < parsedQuery.terms.length; i++) {
            const termObj = expandedTerms[i]
            const shouldCheckMetadata = !termObj.blockMetadata
            let termMatches = false

            // Check if ANY variant of this term matches
            for (const variant of termObj.variants) {
              // Check if variant appears in any field
              if (nameNormalized.includes(variant) || descriptionNormalized.includes(variant)) {
                termMatches = true
                break
              }

              // Check metadata only if allowed
              if (shouldCheckMetadata && metadataNormalized.includes(variant)) {
                termMatches = true
                break
              }

              // Prefix match (before Levenshtein for performance)
              if (nameNormalized.startsWith(variant)) {
                termMatches = true
                break
              }

              // Check Levenshtein for name
              const variantLength = variant.length
              const maxDist = variantLength <= 3 ? 2 : variantLength <= 6 ? 3 : 4
              const levDist = levenshtein(variant, nameNormalized)

              if (levDist <= maxDist) {
                termMatches = true
                break
              }
            }

            // If this term (and none of its variants) doesn't match, reject the NPC
            if (!termMatches) {
              return false
            }
          }

          // All terms matched!
          return true
        })
      }

      // Step 4: Sort by combined score and take top 50
      scoredNpcs.sort((a, b) => a._final_score - b._final_score)
      scoredNpcs = scoredNpcs.slice(0, 50)

      // Clean up scoring metadata
      npcs = scoredNpcs.map(({ fts_score, _lev_distance, _final_score, ...npc }) => npc)
    }
    catch (error) {
      // Fallback: If FTS5 fails, return empty (better than crashing)
      console.error('[NPC Search] FTS5 search failed:', error)
      npcs = []
    }
  }
  else {
    // No search query - return all NPCs for this campaign
    npcs = db.prepare(`
      SELECT
        e.id,
        e.name,
        e.description,
        e.image_url,
        e.metadata,
        e.created_at,
        e.updated_at
      FROM entities e
      WHERE e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
      ORDER BY e.name ASC
    `).all(entityType.id, campaignId) as NpcRow[]
  }

  // Parse metadata JSON
  return npcs.map(npc => ({
    ...npc,
    metadata: npc.metadata ? JSON.parse(npc.metadata as string) : null,
  }))
})
