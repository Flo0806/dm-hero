import { getDb } from '../../utils/db'
import { createLevenshtein } from '../../utils/levenshtein'
import { parseSearchQuery } from '../../utils/search-query-parser'
import { getItemTypeKey, getItemRarityKey, getLocaleFromEvent } from '../../utils/i18n-lookup'

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

  // Get Item entity type ID
  const entityType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Item') as { id: number } | undefined

  if (!entityType) {
    return []
  }

  interface ItemRow {
    id: number
    name: string
    description: string | null
    image_url: string | null
    metadata: string | null
    created_at: string
    updated_at: string
    fts_score?: number
    owner_names?: string | null
  }

  interface ScoredItem extends ItemRow {
    _lev_distance: number
    _final_score: number
  }

  let items: ItemRow[]

  // HYBRID APPROACH: FTS5 pre-filter + Levenshtein ranking
  if (searchQuery && searchQuery.trim().length > 0) {
    const searchTerm = searchQuery.trim().toLowerCase()

    // Parse query with operators (AND, OR, NOT)
    const parsedQuery = parseSearchQuery(searchTerm)

    // Expand all terms with type/rarity key lookups (locale-aware)
    // E.g., "waffe" (DE) → also search for "weapon" key
    // E.g., "weapon" (EN) → also search for "weapon" key
    // E.g., "legendär" (DE) → also search for "legendary" key
    const expandedTerms = parsedQuery.terms.map(term => {
      // Only enable fuzzy matching for longer terms (>= 5 chars) to avoid false matches
      const enableFuzzy = term.length >= 5
      const typeKey = getItemTypeKey(term, enableFuzzy, locale)
      const rarityKey = getItemRarityKey(term, enableFuzzy, locale)

      // If we found a type/rarity key, ONLY use the key (not the original term)
      // This prevents "weapon" (a key) from matching in DE when it shouldn't
      if (typeKey) {
        return { variants: [typeKey], isTypeRarityKey: true, blockMetadata: false }
      }
      if (rarityKey) {
        return { variants: [rarityKey], isTypeRarityKey: true, blockMetadata: false }
      }

      // No type/rarity match - use original term (e.g., item name search)
      // But check if term might be a key in OTHER locale (block cross-language matching)
      const isKeyInOtherLocale = getItemTypeKey(term, false, locale === 'de' ? 'en' : 'de') !== null
        || getItemRarityKey(term, false, locale === 'de' ? 'en' : 'de') !== null

      return { variants: [term], isTypeRarityKey: false, blockMetadata: isKeyInOtherLocale }
    })

    // Rebuild FTS query with expanded terms
    let ftsQuery: string
    if (parsedQuery.hasOperators) {
      // For operator queries, expand each term: "sword AND legendary" → "(sword*) AND (legendary*)"
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
      items = db.prepare(`
        SELECT
          e.id,
          e.name,
          e.description,
          e.image_url,
          e.metadata,
          e.created_at,
          e.updated_at,
          bm25(entities_fts, 10.0, 1.0, 0.5) as fts_score,
          GROUP_CONCAT(DISTINCT owner_npc.name) as owner_names
        FROM entities_fts fts
        INNER JOIN entities e ON fts.rowid = e.id
        LEFT JOIN entity_relations owner_rel ON owner_rel.to_entity_id = e.id
        LEFT JOIN entities owner_npc ON owner_npc.id = owner_rel.from_entity_id AND owner_npc.deleted_at IS NULL AND owner_npc.type_id = (SELECT id FROM entity_types WHERE name = 'NPC')
        WHERE entities_fts MATCH ?
          AND e.type_id = ?
          AND e.campaign_id = ?
          AND e.deleted_at IS NULL
        GROUP BY e.id
        ORDER BY fts_score
        LIMIT 300
      `).all(ftsQuery, entityType.id, campaignId) as ItemRow[]

      // FALLBACK 1: Try prefix wildcard if exact match found nothing (only for simple queries)
      if (items.length === 0 && useExactMatch && !parsedQuery.hasOperators) {
        ftsQuery = `${searchTerm}*`
        useExactMatch = false

        items = db.prepare(`
          SELECT
            e.id,
            e.name,
            e.description,
            e.image_url,
            e.metadata,
            e.created_at,
            e.updated_at,
            bm25(entities_fts, 10.0, 1.0, 0.5) as fts_score,
            GROUP_CONCAT(DISTINCT owner_npc.name) as owner_names
          FROM entities_fts fts
          INNER JOIN entities e ON fts.rowid = e.id
          LEFT JOIN entity_relations owner_rel ON owner_rel.to_entity_id = e.id
          LEFT JOIN entities owner_npc ON owner_npc.id = owner_rel.from_entity_id AND owner_npc.deleted_at IS NULL AND owner_npc.type_id = (SELECT id FROM entity_types WHERE name = 'NPC')
          WHERE entities_fts MATCH ?
            AND e.type_id = ?
            AND e.campaign_id = ?
            AND e.deleted_at IS NULL
          GROUP BY e.id
          ORDER BY fts_score
          LIMIT 300
        `).all(ftsQuery, entityType.id, campaignId) as ItemRow[]
      }

      // FALLBACK 2: For operator queries or when FTS5 returns nothing, use full table scan with Levenshtein
      const hasOrOperator = parsedQuery.fts5Query.toUpperCase().includes(' OR ')
      const hasAndOperator = parsedQuery.fts5Query.toUpperCase().includes(' AND ')

      if (parsedQuery.hasOperators || items.length === 0) {
        items = db.prepare(`
          SELECT
            e.id,
            e.name,
            e.description,
            e.image_url,
            e.metadata,
            e.created_at,
            e.updated_at,
            GROUP_CONCAT(DISTINCT owner_npc.name) as owner_names
          FROM entities e
          LEFT JOIN entity_relations owner_rel ON owner_rel.to_entity_id = e.id
          LEFT JOIN entities owner_npc ON owner_npc.id = owner_rel.from_entity_id AND owner_npc.deleted_at IS NULL AND owner_npc.type_id = (SELECT id FROM entity_types WHERE name = 'NPC')
          WHERE e.type_id = ?
            AND e.campaign_id = ?
            AND e.deleted_at IS NULL
          GROUP BY e.id
          ORDER BY e.name ASC
        `).all(entityType.id, campaignId) as ItemRow[]
      }

      // Step 2: Apply Levenshtein distance for better ranking
      let scoredItems = items.map((item: ItemRow): ScoredItem => {
        const nameLower = item.name.toLowerCase()

        // Smart distance calculation
        const exactMatch = nameLower === searchTerm
        const startsWithQuery = nameLower.startsWith(searchTerm)
        const containsQuery = nameLower.includes(searchTerm)

        // Check if search term appears in metadata, description, or owner names (FTS5 match but not in name)
        const metadataLower = item.metadata?.toLowerCase() || ''
        const descriptionLower = (item.description || '').toLowerCase()
        const ownerNamesLower = (item.owner_names || '').toLowerCase()
        const isMetadataMatch = metadataLower.includes(searchTerm)
        const isDescriptionMatch = descriptionLower.includes(searchTerm)
        const isOwnerMatch = ownerNamesLower.includes(searchTerm)
        const isNonNameMatch = (isMetadataMatch || isDescriptionMatch || isOwnerMatch) && !containsQuery

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
        const ftsScore = item.fts_score ?? 0
        let finalScore = ftsScore + (levDistance * 0.5)

        // Apply bonuses (reduce score = better ranking)
        if (exactMatch) finalScore -= 1000
        if (startsWithQuery) finalScore -= 100
        if (containsQuery) finalScore -= 50
        if (isOwnerMatch) finalScore -= 30 // Owner matches are very good
        if (isMetadataMatch) finalScore -= 25 // Metadata matches are good
        if (isDescriptionMatch) finalScore -= 10 // Description matches are ok

        return {
          ...item,
          _lev_distance: levDistance,
          _final_score: finalScore,
        }
      })

      // Step 3: Filter by Levenshtein distance
      if (!parsedQuery.hasOperators) {
        // Simple query: check if ANY expanded term matches
        scoredItems = scoredItems.filter(item => {
          const nameLower = item.name.toLowerCase()
          const metadataLower = item.metadata?.toLowerCase() || ''
          const descriptionLower = (item.description || '').toLowerCase()
          const ownerNamesLower = (item.owner_names || '').toLowerCase()

          // Check ALL expanded terms (original + type/rarity keys)
          for (const termObj of expandedTerms) {
            for (const variant of termObj.variants) {
              // Check metadata ONLY if not blocked (prevents cross-language key matching)
              const shouldCheckMetadata = !termObj.blockMetadata

              // Exact/substring match in any field
              if (nameLower.includes(variant) || descriptionLower.includes(variant) || ownerNamesLower.includes(variant)) {
                return true
              }

              // Check metadata only if allowed
              if (shouldCheckMetadata && metadataLower.includes(variant)) {
                return true
              }

              // Prefix match (before Levenshtein for performance)
              if (nameLower.startsWith(variant)) {
                return true
              }

              // Levenshtein match for name
              const variantLength = variant.length
              const maxDist = variantLength <= 3 ? 2 : variantLength <= 6 ? 3 : 4
              const levDist = levenshtein(variant, nameLower)

              if (levDist <= maxDist) {
                return true
              }

              // Levenshtein match for owner names (split by comma, check each name)
              if (ownerNamesLower.length > 0) {
                const ownerNames = ownerNamesLower.split(',').map(n => n.trim())
                for (const ownerName of ownerNames) {
                  if (ownerName.length === 0) continue
                  const ownerLevDist = levenshtein(variant, ownerName)
                  if (ownerLevDist <= maxDist) {
                    return true
                  }
                }
              }
            }
          }

          return false // No variant matched
        })
      }
      else if (hasOrOperator && !hasAndOperator) {
        // OR query: at least ONE term must match
        scoredItems = scoredItems.filter(item => {
          const nameLower = item.name.toLowerCase()
          const metadataLower = item.metadata?.toLowerCase() || ''
          const descriptionLower = (item.description || '').toLowerCase()
          const ownerNamesLower = (item.owner_names || '').toLowerCase()

          // Check if at least one term (or its variants) matches
          for (let i = 0; i < parsedQuery.terms.length; i++) {
            const termObj = expandedTerms[i]
            const shouldCheckMetadata = !termObj.blockMetadata

            // Check if ANY variant matches
            for (const variant of termObj.variants) {
              // Check if variant appears in any field
              if (nameLower.includes(variant) || descriptionLower.includes(variant) || ownerNamesLower.includes(variant)) {
                return true // At least one variant matches
              }

              // Check metadata only if allowed
              if (shouldCheckMetadata && metadataLower.includes(variant)) {
                return true
              }

              // Prefix match (before Levenshtein for performance)
              if (nameLower.startsWith(variant)) {
                return true
              }

              // Check Levenshtein for name
              const variantLength = variant.length
              const maxDist = variantLength <= 3 ? 2 : variantLength <= 6 ? 3 : 4
              const levDist = levenshtein(variant, nameLower)

              if (levDist <= maxDist) {
                return true // Close enough match
              }

              // Levenshtein match for owner names (split by comma, check each name)
              if (ownerNamesLower.length > 0) {
                const ownerNames = ownerNamesLower.split(',').map(n => n.trim())
                for (const ownerName of ownerNames) {
                  if (ownerName.length === 0) continue
                  const ownerLevDist = levenshtein(variant, ownerName)
                  if (ownerLevDist <= maxDist) {
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
        scoredItems = scoredItems.filter(item => {
          const nameLower = item.name.toLowerCase()
          const metadataLower = item.metadata?.toLowerCase() || ''
          const descriptionLower = (item.description || '').toLowerCase()
          const ownerNamesLower = (item.owner_names || '').toLowerCase()

          // Check if ALL terms (or their expanded keys) match
          for (let i = 0; i < parsedQuery.terms.length; i++) {
            const termObj = expandedTerms[i]
            const shouldCheckMetadata = !termObj.blockMetadata
            let termMatches = false

            // Check if ANY variant of this term matches
            for (const variant of termObj.variants) {
              // Check if variant appears in any field
              if (nameLower.includes(variant) || descriptionLower.includes(variant) || ownerNamesLower.includes(variant)) {
                termMatches = true
                break
              }

              // Check metadata only if allowed
              if (shouldCheckMetadata && metadataLower.includes(variant)) {
                termMatches = true
                break
              }

              // Prefix match (before Levenshtein for performance)
              if (nameLower.startsWith(variant)) {
                termMatches = true
                break
              }

              // Check Levenshtein for name
              const variantLength = variant.length
              const maxDist = variantLength <= 3 ? 2 : variantLength <= 6 ? 3 : 4
              const levDist = levenshtein(variant, nameLower)

              if (levDist <= maxDist) {
                termMatches = true
                break
              }

              // Levenshtein match for owner names (split by comma, check each name)
              if (!termMatches && ownerNamesLower.length > 0) {
                const ownerNames = ownerNamesLower.split(',').map(n => n.trim())
                for (const ownerName of ownerNames) {
                  if (ownerName.length === 0) continue
                  const ownerLevDist = levenshtein(variant, ownerName)
                  if (ownerLevDist <= maxDist) {
                    termMatches = true
                    break
                  }
                }
                if (termMatches) break
              }
            }

            // If this term (and none of its variants) doesn't match, reject the item
            if (!termMatches) {
              return false
            }
          }

          // All terms matched!
          return true
        })
      }

      // Step 4: Sort by combined score and take top 50
      scoredItems.sort((a, b) => a._final_score - b._final_score)
      scoredItems = scoredItems.slice(0, 50)

      // Clean up scoring metadata
      items = scoredItems.map(({ fts_score, _lev_distance, _final_score, ...item }) => item)
    }
    catch (error) {
      // Fallback: If FTS5 fails, return empty (better than crashing)
      console.error('[Item Search] FTS5 search failed:', error)
      items = []
    }
  }
  else {
    // No search query - return all items for this campaign
    items = db.prepare(`
      SELECT
        e.id,
        e.name,
        e.description,
        e.image_url,
        e.metadata,
        e.created_at,
        e.updated_at,
        GROUP_CONCAT(DISTINCT owner_npc.name) as owner_names
      FROM entities e
      LEFT JOIN entity_relations owner_rel ON owner_rel.to_entity_id = e.id
      LEFT JOIN entities owner_npc ON owner_npc.id = owner_rel.from_entity_id AND owner_npc.deleted_at IS NULL AND owner_npc.type_id = (SELECT id FROM entity_types WHERE name = 'NPC')
      WHERE e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
      GROUP BY e.id
      ORDER BY e.name ASC
    `).all(entityType.id, campaignId) as ItemRow[]
  }

  // Parse metadata JSON
  return items.map(item => ({
    ...item,
    metadata: item.metadata ? JSON.parse(item.metadata as string) : null,
  }))
})
