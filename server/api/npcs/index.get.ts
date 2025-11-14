import { getDb } from '../../utils/db'
import { createLevenshtein } from '../../utils/levenshtein'
import { parseSearchQuery } from '../../utils/search-query-parser'
import {
  getRaceKey,
  getClassKey,
  getRaceSearchVariants,
  getClassSearchVariants,
  getLocaleFromEvent,
} from '../../utils/i18n-lookup'
import { normalizeText } from '../../utils/normalize'
import type { NpcMetadata } from '../../types/metadata'

// Initialize Levenshtein function once
const levenshtein = createLevenshtein()

export default defineEventHandler(async (event) => {
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
  const entityType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as
    | { id: number }
    | undefined

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
    linked_faction_names?: string | null
    linked_location_names?: string | null
    linked_lore_names?: string | null
  }

  interface ScoredNpc extends NpcRow {
    _lev_distance: number
    _final_score: number
  }

  let npcs: NpcRow[]

  // HYBRID APPROACH: FTS5 pre-filter + Levenshtein ranking
  if (searchQuery && searchQuery.trim().length > 0) {
    const originalSearchTerm = searchQuery.trim()

    // Check if this is a quoted phrase BEFORE normalization
    const isQuotedPhrase = originalSearchTerm.startsWith('"') && originalSearchTerm.endsWith('"')

    // If quoted, remove quotes, normalize, then re-add quotes
    let searchTerm: string
    if (isQuotedPhrase) {
      const withoutQuotes = originalSearchTerm.slice(1, -1) // Remove surrounding quotes
      searchTerm = `"${normalizeText(withoutQuotes)}"` // Normalize and re-add quotes
    } else {
      searchTerm = normalizeText(originalSearchTerm)
    }

    // Parse query with operators (AND, OR, NOT) using searchTerm (now with preserved quotes)
    const parsedQuery = parseSearchQuery(searchTerm)

    // Expand all terms with race/class key lookups (locale-aware)
    // IMPORTANT: Use ORIGINAL terms (with hyphens) for race/class lookup, e.g., "en-bruddi" not "enbruddi"
    // E.g., "mensch" (DE) → also search for "human" key
    // E.g., "mensh" (DE typo) → also search for "human" key (fuzzy match)
    // E.g., "human" (EN) → also search for "human" key
    // E.g., "humen" (EN typo) → also search for "human" key (fuzzy match)
    const expandedTerms = await Promise.all(
      parsedQuery.terms.map(async (term) => {
        // Only enable fuzzy matching for longer terms (>= 5 chars) to avoid false matches
        // e.g., "bern" should NOT match "barde" (class), but "hexen" should match "hexenmeister"
        const enableFuzzy = term.length >= 5
        const raceKey = await getRaceKey(term, enableFuzzy, locale)
        const classKey = await getClassKey(term, enableFuzzy, locale)

        // If we found a race/class key, use ALL search variants (key + localized names)
        // This allows FTS5 to find NPCs by both the key in metadata AND localized names in FTS
        if (raceKey) {
          const variants = await getRaceSearchVariants(term, locale)
          return { variants, isRaceClassKey: true }
        }
        if (classKey) {
          const variants = await getClassSearchVariants(term, locale)
          return { variants, isRaceClassKey: true }
        }

        // No race/class match - use original term (e.g., NPC name search)
        // But check if term might be a key in OTHER locale (block cross-language matching)
        const isKeyInOtherLocale =
          (await getRaceKey(term, false, locale === 'de' ? 'en' : 'de')) !== null ||
          (await getClassKey(term, false, locale === 'de' ? 'en' : 'de')) !== null

        // IMPORTANT: Normalize term for case-insensitive matching ("Bernhard" → "bernhard")
        return {
          variants: [normalizeText(term)],
          isRaceClassKey: false,
          blockMetadata: isKeyInOtherLocale,
        }
      }),
    )

    // Helper function to quote FTS5 terms that contain special characters
    function quoteFts5Term(term: string): string {
      // FTS5 special chars that need quoting: - (column separator), () [] {}
      // Quote terms that contain hyphens or other special characters
      if (
        term.includes('-') ||
        term.includes('(') ||
        term.includes(')') ||
        term.includes('[') ||
        term.includes(']')
      ) {
        // Escape any double quotes in the term first
        const escaped = term.replace(/"/g, '""')
        return `"${escaped}"`
      }
      return term
    }

    // Rebuild FTS query with expanded terms
    let ftsQuery: string
    if (parsedQuery.hasOperators) {
      // For operator queries, expand each term: "bernard AND mensch" → "(bernard*) AND (mensch* OR human*)"
      const expandedFtsTerms = expandedTerms.map((termObj) => {
        const keys = termObj.variants
        if (keys.length === 1) {
          return `${quoteFts5Term(keys[0])}*`
        } else {
          return `(${keys.map((k) => `${quoteFts5Term(k)}*`).join(' OR ')})`
        }
      })

      // Reconstruct query with original operators
      const fts5QueryUpper = parsedQuery.fts5Query.toUpperCase()
      if (fts5QueryUpper.includes(' AND ')) {
        ftsQuery = expandedFtsTerms.join(' AND ')
      } else if (fts5QueryUpper.includes(' OR ')) {
        ftsQuery = expandedFtsTerms.join(' OR ')
      } else {
        ftsQuery = expandedFtsTerms.join(' ')
      }
    } else {
      // Simple query: add all keys as OR
      const allKeys = expandedTerms.flatMap((termObj) => termObj.variants)
      ftsQuery = allKeys.map((k) => `${quoteFts5Term(k)}*`).join(' OR ')
    }

    let useExactMatch = parsedQuery.useExactFirst

    try {
      // Step 1: FTS5 pre-filter (fast, gets ~100 candidates)
      // Note: Cannot use bm25() with GROUP_CONCAT in same query - incompatible aggregations
      npcs = db
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
          GROUP_CONCAT(DISTINCT faction.name) as linked_faction_names,
          GROUP_CONCAT(DISTINCT location.name) as linked_location_names,
          GROUP_CONCAT(DISTINCT lore.name) as linked_lore_names
        FROM entities_fts fts
        INNER JOIN entities e ON fts.rowid = e.id
        LEFT JOIN entity_relations faction_rel ON faction_rel.from_entity_id = e.id
        LEFT JOIN entities faction ON faction.id = faction_rel.to_entity_id AND faction.deleted_at IS NULL AND faction.type_id = (SELECT id FROM entity_types WHERE name = 'Faction')
        LEFT JOIN entity_relations location_rel ON location_rel.from_entity_id = e.id
        LEFT JOIN entities location ON location.id = location_rel.to_entity_id AND location.deleted_at IS NULL AND location.type_id = (SELECT id FROM entity_types WHERE name = 'Location')
        LEFT JOIN entity_relations lore_rel ON lore_rel.from_entity_id = e.id
        LEFT JOIN entities lore ON lore.id = lore_rel.to_entity_id AND lore.deleted_at IS NULL AND lore.type_id = (SELECT id FROM entity_types WHERE name = 'Lore')
        WHERE entities_fts MATCH ?
          AND e.type_id = ?
          AND e.campaign_id = ?
          AND e.deleted_at IS NULL
        GROUP BY e.id
        ORDER BY e.name ASC
        LIMIT 300
      `,
        )
        .all(ftsQuery, entityType.id, campaignId) as NpcRow[]
      // FALLBACK 1: Try prefix wildcard if exact match found nothing (only for simple queries)
      if (npcs.length === 0 && useExactMatch && !parsedQuery.hasOperators) {
        ftsQuery = `${searchTerm}*`
        useExactMatch = false

        npcs = db
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
            GROUP_CONCAT(DISTINCT faction.name) as linked_faction_names,
            GROUP_CONCAT(DISTINCT location.name) as linked_location_names,
            GROUP_CONCAT(DISTINCT lore.name) as linked_lore_names
          FROM entities_fts fts
          INNER JOIN entities e ON fts.rowid = e.id
          LEFT JOIN entity_relations faction_rel ON faction_rel.from_entity_id = e.id
          LEFT JOIN entities faction ON faction.id = faction_rel.to_entity_id AND faction.deleted_at IS NULL AND faction.type_id = (SELECT id FROM entity_types WHERE name = 'Faction')
          LEFT JOIN entity_relations location_rel ON location_rel.from_entity_id = e.id
          LEFT JOIN entities location ON location.id = location_rel.to_entity_id AND location.deleted_at IS NULL AND location.type_id = (SELECT id FROM entity_types WHERE name = 'Location')
          LEFT JOIN entity_relations lore_rel ON lore_rel.from_entity_id = e.id
          LEFT JOIN entities lore ON lore.id = lore_rel.to_entity_id AND lore.deleted_at IS NULL AND lore.type_id = (SELECT id FROM entity_types WHERE name = 'Lore')
          WHERE entities_fts MATCH ?
            AND e.type_id = ?
            AND e.campaign_id = ?
            AND e.deleted_at IS NULL
          GROUP BY e.id
          ORDER BY e.name ASC
          LIMIT 300
        `,
          )
          .all(ftsQuery, entityType.id, campaignId) as NpcRow[]
      }

      // FALLBACK 2: Decide based on operator type OR if FTS5 found nothing
      const hasOrOperator = parsedQuery.fts5Query.toUpperCase().includes(' OR ')
      const hasAndOperator = parsedQuery.fts5Query.toUpperCase().includes(' AND ')

      // For operator queries (AND/OR): ALWAYS use Levenshtein fallback
      // This ensures we catch typos in ALL terms
      // ALSO: If FTS5 found 0 results, use full table scan (catches cross-entity searches like Lore names)
      if (parsedQuery.hasOperators || npcs.length === 0) {
        npcs = db
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
            GROUP_CONCAT(DISTINCT faction.name) as linked_faction_names,
            GROUP_CONCAT(DISTINCT location.name) as linked_location_names,
            GROUP_CONCAT(DISTINCT lore.name) as linked_lore_names
          FROM entities e
          LEFT JOIN entity_relations faction_rel ON faction_rel.from_entity_id = e.id
          LEFT JOIN entities faction ON faction.id = faction_rel.to_entity_id AND faction.deleted_at IS NULL AND faction.type_id = (SELECT id FROM entity_types WHERE name = 'Faction')
          LEFT JOIN entity_relations location_rel ON location_rel.from_entity_id = e.id
          LEFT JOIN entities location ON location.id = location_rel.to_entity_id AND location.deleted_at IS NULL AND location.type_id = (SELECT id FROM entity_types WHERE name = 'Location')
          LEFT JOIN entity_relations lore_rel ON lore_rel.from_entity_id = e.id
          LEFT JOIN entities lore ON lore.id = lore_rel.to_entity_id AND lore.deleted_at IS NULL AND lore.type_id = (SELECT id FROM entity_types WHERE name = 'Lore')
          WHERE e.type_id = ?
            AND e.campaign_id = ?
            AND e.deleted_at IS NULL
          GROUP BY e.id
          ORDER BY e.name ASC
        `,
          )
          .all(entityType.id, campaignId) as NpcRow[]
      }

      // Step 2: Apply Levenshtein distance for better ranking
      let scoredNpcs = npcs.map((npc: NpcRow): ScoredNpc => {
        const nameNormalized = normalizeText(npc.name)

        // Smart distance calculation
        const exactMatch = nameNormalized === searchTerm
        const startsWithQuery = nameNormalized.startsWith(searchTerm)
        const containsQuery = nameNormalized.includes(searchTerm)

        // Check if search term appears in metadata, description, linked factions, linked locations, or linked lore (FTS5 match but not in name)
        const metadataNormalized = normalizeText(npc.metadata || '')
        const descriptionNormalized = normalizeText(npc.description || '')
        const linkedFactionNamesNormalized = normalizeText(npc.linked_faction_names || '')
        const linkedLocationNamesNormalized = normalizeText(npc.linked_location_names || '')
        const linkedLoreNamesNormalized = normalizeText(npc.linked_lore_names || '')
        const isMetadataMatch = metadataNormalized.includes(searchTerm)
        const isDescriptionMatch = descriptionNormalized.includes(searchTerm)
        const isFactionMatch = linkedFactionNamesNormalized.includes(searchTerm)
        const isLocationMatch = linkedLocationNamesNormalized.includes(searchTerm)
        const isLoreMatch = linkedLoreNamesNormalized.includes(searchTerm)
        const isNonNameMatch =
          (isMetadataMatch || isDescriptionMatch || isFactionMatch || isLocationMatch || isLoreMatch) &&
          !containsQuery

        let levDistance: number

        if (isNonNameMatch) {
          // Metadata/Description match: Set distance to 0 (perfect match conceptually)
          levDistance = 0
        } else if (startsWithQuery) {
          // If name starts with query, distance is just the remaining chars
          // "bern" vs "bernhard" → distance = 4 (remaining: "hard")
          levDistance = nameNormalized.length - searchTerm.length
        } else {
          // Full Levenshtein distance for non-prefix matches
          levDistance = levenshtein(searchTerm, nameNormalized)
        }

        // Combined score: FTS score + weighted Levenshtein distance
        const ftsScore = npc.fts_score ?? 0
        let finalScore = ftsScore + levDistance * 0.5

        // Apply bonuses (reduce score = better ranking)
        if (exactMatch) finalScore -= 1000
        if (startsWithQuery) finalScore -= 100
        if (containsQuery) finalScore -= 50
        if (isFactionMatch) finalScore -= 30 // Faction matches are very good
        if (isLocationMatch) finalScore -= 30 // Location matches are very good
        if (isLoreMatch) finalScore -= 30 // Lore matches are very good
        if (isMetadataMatch) finalScore -= 25 // Metadata matches are good
        if (isDescriptionMatch) finalScore -= 10 // Description matches are ok

        // SPECIAL: Multi-word faction match bonus (e.g., "die grauen jäger")
        // Check if ALL terms from parsedQuery appear in this NPC's faction names
        if (parsedQuery.terms.length > 1 && linkedFactionNamesNormalized.length > 0) {
          const allTermsInThisFaction = parsedQuery.terms.every((term) =>
            linkedFactionNamesNormalized.includes(normalizeText(term)),
          )
          if (allTermsInThisFaction) {
            finalScore -= 500 // HUGE bonus - these should be at the top!
          }
        }

        // SPECIAL: Multi-word lore match bonus (e.g., "böser frosch")
        // Check if ALL terms from parsedQuery appear in this NPC's lore names
        if (parsedQuery.terms.length > 1 && linkedLoreNamesNormalized.length > 0) {
          const allTermsInThisLore = parsedQuery.terms.every((term) =>
            linkedLoreNamesNormalized.includes(normalizeText(term)),
          )
          if (allTermsInThisLore) {
            finalScore -= 500 // HUGE bonus - these should be at the top!
          }
        }

        return {
          ...npc,
          _lev_distance: levDistance,
          _final_score: finalScore,
        }
      })

      // Pre-fetch all race/class variants for faster lookup
      const raceVariantsCache = new Map<string, string[]>()
      const classVariantsCache = new Map<string, string[]>()

      // Helper function to check if a variant matches an NPC's race/class (including localized names)
      async function variantMatchesRaceOrClass(
        variant: string,
        metadataObj: Pick<NpcMetadata, 'race' | 'class'> | null,
        termObj: { isRaceClassKey?: boolean; variants: string[]; blockMetadata?: boolean },
      ): Promise<boolean> {
        if (!termObj.isRaceClassKey || !metadataObj) return false

        const raceKey = metadataObj.race
        const classKey = metadataObj.class

        // Check if the variant matches the race/class key directly
        if (raceKey && normalizeText(raceKey).includes(variant)) {
          return true
        }
        if (classKey && normalizeText(classKey).includes(variant)) {
          return true
        }

        // Also check if this variant is a localized name for the same race/class
        // E.g., variant="brudi" and raceKey="TEst" → check if "brudi" is a localized name for "TEst"
        if (raceKey) {
          if (!raceVariantsCache.has(raceKey)) {
            raceVariantsCache.set(raceKey, await getRaceSearchVariants(raceKey, locale))
          }
          const raceVariants = raceVariantsCache.get(raceKey)!
          if (raceVariants.some((v) => normalizeText(v).includes(variant))) {
            return true
          }
        }
        if (classKey) {
          if (!classVariantsCache.has(classKey)) {
            classVariantsCache.set(classKey, await getClassSearchVariants(classKey, locale))
          }
          const classVariants = classVariantsCache.get(classKey)!
          if (classVariants.some((v) => normalizeText(v).includes(variant))) {
            return true
          }
        }

        return false
      }

      // Step 3: Filter by Levenshtein distance
      const isQuotedPhraseSearch =
        parsedQuery.fts5Query.startsWith('"') && parsedQuery.fts5Query.endsWith('"')

      if (isQuotedPhraseSearch) {
        // Quoted phrase: EXACT substring match (no Levenshtein), but check all fields including cross-entity
        const exactPhrase = parsedQuery.fts5Query.slice(1, -1) // Remove quotes

        scoredNpcs = scoredNpcs.filter((npc) => {
          const nameNormalized = normalizeText(npc.name)
          const metadataNormalized = normalizeText(npc.metadata || '')
          const descriptionNormalized = normalizeText(npc.description || '')
          const linkedFactionNamesNormalized = normalizeText(npc.linked_faction_names || '')
          const linkedLocationNamesNormalized = normalizeText(npc.linked_location_names || '')
          const linkedLoreNamesNormalized = normalizeText(npc.linked_lore_names || '')

          // Check if EXACT phrase appears in ANY field
          return (
            nameNormalized.includes(exactPhrase) ||
            descriptionNormalized.includes(exactPhrase) ||
            metadataNormalized.includes(exactPhrase) ||
            linkedFactionNamesNormalized.includes(exactPhrase) ||
            linkedLocationNamesNormalized.includes(exactPhrase) ||
            linkedLoreNamesNormalized.includes(exactPhrase)
          )
        })
      } else if (!parsedQuery.hasOperators) {
        // Simple query: check if ANY expanded term matches
        const filtered: ScoredNpc[] = []
        for (const npc of scoredNpcs) {
          const nameNormalized = normalizeText(npc.name)
          const metadataNormalized = normalizeText(npc.metadata || '')
          const descriptionNormalized = normalizeText(npc.description || '')
          const linkedFactionNamesNormalized = normalizeText(npc.linked_faction_names || '')
          const linkedLocationNamesNormalized = normalizeText(npc.linked_location_names || '')
          const linkedLoreNamesNormalized = normalizeText(npc.linked_lore_names || '')

          // Parse metadata to check race/class with localized names
          let metadataObj: Pick<NpcMetadata, 'race' | 'class'> | null = null
          try {
            metadataObj = npc.metadata ? JSON.parse(npc.metadata) : null
          } catch {
            // Invalid JSON - fallback to string search
          }

          let shouldInclude = false

          // Special case: Multi-word search (e.g., "die grauen jäger" or "Bernhard von")
          // If ALL search terms appear in ANY field (name, description, or faction), it's a match
          if (expandedTerms.length > 1) {
            // Check if all terms appear in name
            const allTermsInName = expandedTerms.every((termObj) =>
              termObj.variants.some((variant) => nameNormalized.includes(variant)),
            )
            if (allTermsInName) {
              shouldInclude = true
            }

            // Check if all terms appear in faction names
            if (!shouldInclude && linkedFactionNamesNormalized.length > 0) {
              const allTermsInFaction = expandedTerms.every((termObj) =>
                termObj.variants.some((variant) => linkedFactionNamesNormalized.includes(variant)),
              )
              if (allTermsInFaction) {
                shouldInclude = true
              }
            }

            // Check if all terms appear in location names
            if (!shouldInclude && linkedLocationNamesNormalized.length > 0) {
              const allTermsInLocation = expandedTerms.every((termObj) =>
                termObj.variants.some((variant) => linkedLocationNamesNormalized.includes(variant)),
              )
              if (allTermsInLocation) {
                shouldInclude = true
              }
            }

            // Check if all terms appear in lore names
            if (!shouldInclude && linkedLoreNamesNormalized.length > 0) {
              const allTermsInLore = expandedTerms.every((termObj) =>
                termObj.variants.some((variant) => linkedLoreNamesNormalized.includes(variant)),
              )
              if (allTermsInLore) {
                shouldInclude = true
              }
            }

            // Check if all terms appear in description
            if (!shouldInclude && descriptionNormalized.length > 0) {
              const allTermsInDescription = expandedTerms.every((termObj) =>
                termObj.variants.some((variant) => descriptionNormalized.includes(variant)),
              )
              if (allTermsInDescription) {
                shouldInclude = true
              }
            }
          }

          // For single-word OR if multi-word didn't match, check individual terms
          if (!shouldInclude) {
            // Check ALL expanded terms (original + race/class keys)
            for (const termObj of expandedTerms) {
              for (const variant of termObj.variants) {
                // Check metadata ONLY if not blocked (prevents cross-language key matching)
                const shouldCheckMetadata = !termObj.blockMetadata

                // Exact/substring match in any field
                if (
                  nameNormalized.includes(variant) ||
                  descriptionNormalized.includes(variant) ||
                  linkedFactionNamesNormalized.includes(variant) ||
                  linkedLocationNamesNormalized.includes(variant) ||
                  linkedLoreNamesNormalized.includes(variant)
                ) {
                  shouldInclude = true
                  break
                }

                // Check metadata only if allowed
                if (shouldCheckMetadata && metadataNormalized.includes(variant)) {
                  shouldInclude = true
                  break
                }

                // For race/class terms: Check if metadata.race or metadata.class matches (including localized names)
                if (await variantMatchesRaceOrClass(variant, metadataObj, termObj)) {
                  shouldInclude = true
                  break
                }

                // Prefix match (before Levenshtein for performance)
                if (nameNormalized.startsWith(variant)) {
                  shouldInclude = true
                  break
                }

                // Levenshtein match for name
                const variantLength = variant.length
                const maxDist = variantLength <= 3 ? 2 : variantLength <= 6 ? 3 : 4
                const levDist = levenshtein(variant, nameNormalized)

                if (levDist <= maxDist) {
                  shouldInclude = true
                  break
                }

                // Levenshtein match for linked Faction names (split by comma, then by words)
                if (linkedFactionNamesNormalized.length > 0) {
                  const factionNames = linkedFactionNamesNormalized.split(',').map((n) => n.trim())
                  for (const factionName of factionNames) {
                    if (factionName.length === 0) continue
                    // Split each faction name into words (e.g., "Die Harpers" → ["die", "harpers"])
                    const factionWords = factionName.split(/\s+/)
                    for (const word of factionWords) {
                      if (word.length === 0) continue
                      const factionLevDist = levenshtein(variant, word)
                      if (factionLevDist <= maxDist) {
                        shouldInclude = true
                        break
                      }
                    }
                    if (shouldInclude) break
                  }
                }

                // Levenshtein match for linked Lore names (split by comma, then by words)
                if (!shouldInclude && linkedLoreNamesNormalized.length > 0) {
                  const loreNames = linkedLoreNamesNormalized.split(',').map((n) => n.trim())
                  for (const loreName of loreNames) {
                    if (loreName.length === 0) continue
                    // Split each lore name into words (e.g., "Böser Frosch" → ["böser", "frosch"])
                    const loreWords = loreName.split(/\s+/)
                    for (const word of loreWords) {
                      if (word.length === 0) continue
                      const loreLevDist = levenshtein(variant, word)
                      if (loreLevDist <= maxDist) {
                        shouldInclude = true
                        break
                      }
                    }
                    if (shouldInclude) break
                  }
                }

                if (shouldInclude) break
              }

              if (shouldInclude) break
            }
          }

          if (shouldInclude) {
            filtered.push(npc)
          }
        }
        scoredNpcs = filtered
      } else if (hasOrOperator && !hasAndOperator) {
        // OR query: at least ONE term must match
        const filtered: ScoredNpc[] = []
        for (const npc of scoredNpcs) {
          const nameNormalized = normalizeText(npc.name)
          const metadataNormalized = normalizeText(npc.metadata || '')
          const descriptionNormalized = normalizeText(npc.description || '')
          const linkedFactionNamesNormalized = normalizeText(npc.linked_faction_names || '')
          const linkedLocationNamesNormalized = normalizeText(npc.linked_location_names || '')
          const linkedLoreNamesNormalized = normalizeText(npc.linked_lore_names || '')

          // Parse metadata to check race/class with localized names
          let metadataObj: Pick<NpcMetadata, 'race' | 'class'> | null = null
          try {
            metadataObj = npc.metadata ? JSON.parse(npc.metadata) : null
          } catch {
            // Invalid JSON - fallback to string search
          }

          let shouldInclude = false

          // Check if at least one term (or its variants) matches
          for (let i = 0; i < parsedQuery.terms.length; i++) {
            const termObj = expandedTerms[i]
            const shouldCheckMetadata = !termObj.blockMetadata

            // Check if ANY variant matches
            for (const variant of termObj.variants) {
              // Check if variant appears in any field
              if (
                nameNormalized.includes(variant) ||
                descriptionNormalized.includes(variant) ||
                linkedFactionNamesNormalized.includes(variant) ||
                linkedLocationNamesNormalized.includes(variant) ||
                linkedLoreNamesNormalized.includes(variant)
              ) {
                shouldInclude = true
                break
              }

              // Check metadata only if allowed
              if (shouldCheckMetadata && metadataNormalized.includes(variant)) {
                shouldInclude = true
                break
              }

              // For race/class terms: Check if metadata.race or metadata.class matches (including localized names)
              if (await variantMatchesRaceOrClass(variant, metadataObj, termObj)) {
                shouldInclude = true
                break
              }

              // Prefix match (before Levenshtein for performance)
              if (nameNormalized.startsWith(variant)) {
                shouldInclude = true
                break
              }

              // Check Levenshtein for name
              const variantLength = variant.length
              const maxDist = variantLength <= 3 ? 2 : variantLength <= 6 ? 3 : 4
              const levDist = levenshtein(variant, nameNormalized)

              if (levDist <= maxDist) {
                shouldInclude = true
                break
              }

              // Levenshtein match for linked Faction names (split by comma, then by words)
              if (linkedFactionNamesNormalized.length > 0) {
                const factionNames = linkedFactionNamesNormalized.split(',').map((n) => n.trim())
                for (const factionName of factionNames) {
                  if (factionName.length === 0) continue
                  const factionWords = factionName.split(/\s+/)
                  for (const word of factionWords) {
                    if (word.length === 0) continue
                    const factionLevDist = levenshtein(variant, word)
                    if (factionLevDist <= maxDist) {
                      shouldInclude = true
                      break
                    }
                  }
                  if (shouldInclude) break
                }
              }

              // Levenshtein match for linked Location names (split by comma, then by words)
              if (!shouldInclude && linkedLocationNamesNormalized.length > 0) {
                const locationNames = linkedLocationNamesNormalized.split(',').map((n) => n.trim())
                for (const locationName of locationNames) {
                  if (locationName.length === 0) continue
                  const locationWords = locationName.split(/\s+/)
                  for (const word of locationWords) {
                    if (word.length === 0) continue
                    const locationLevDist = levenshtein(variant, word)
                    if (locationLevDist <= maxDist) {
                      shouldInclude = true
                      break
                    }
                  }
                  if (shouldInclude) break
                }
              }

              // Levenshtein match for linked Lore names (split by comma, then by words)
              if (!shouldInclude && linkedLoreNamesNormalized.length > 0) {
                const loreNames = linkedLoreNamesNormalized.split(',').map((n) => n.trim())
                for (const loreName of loreNames) {
                  if (loreName.length === 0) continue
                  const loreWords = loreName.split(/\s+/)
                  for (const word of loreWords) {
                    if (word.length === 0) continue
                    const loreLevDist = levenshtein(variant, word)
                    if (loreLevDist <= maxDist) {
                      shouldInclude = true
                      break
                    }
                  }
                  if (shouldInclude) break
                }
              }

              if (shouldInclude) break
            }

            if (shouldInclude) break
          }

          if (shouldInclude) {
            filtered.push(npc)
          }
        }
        scoredNpcs = filtered
      } else if (hasAndOperator) {
        // AND query: ALL terms must match
        const filtered: ScoredNpc[] = []
        for (const npc of scoredNpcs) {
          const nameNormalized = normalizeText(npc.name)
          const metadataNormalized = normalizeText(npc.metadata || '')
          const descriptionNormalized = normalizeText(npc.description || '')
          const linkedFactionNamesNormalized = normalizeText(npc.linked_faction_names || '')
          const linkedLocationNamesNormalized = normalizeText(npc.linked_location_names || '')
          const linkedLoreNamesNormalized = normalizeText(npc.linked_lore_names || '')

          // Parse metadata to check race/class with localized names
          let metadataObj: Pick<NpcMetadata, 'race' | 'class'> | null = null
          try {
            metadataObj = npc.metadata ? JSON.parse(npc.metadata) : null
          } catch {
            // Invalid JSON - fallback to string search
          }

          let shouldInclude = true

          // Check if ALL terms (or their expanded keys) match
          for (let i = 0; i < parsedQuery.terms.length; i++) {
            const termObj = expandedTerms[i]
            const shouldCheckMetadata = !termObj.blockMetadata
            let termMatches = false

            // Check if ANY variant of this term matches
            for (const variant of termObj.variants) {
              // Check if variant appears in any field
              if (
                nameNormalized.includes(variant) ||
                descriptionNormalized.includes(variant) ||
                linkedFactionNamesNormalized.includes(variant) ||
                linkedLocationNamesNormalized.includes(variant) ||
                linkedLoreNamesNormalized.includes(variant)
              ) {
                termMatches = true
                break
              }

              // Check metadata only if allowed
              if (shouldCheckMetadata && metadataNormalized.includes(variant)) {
                termMatches = true
                break
              }

              // For race/class terms: Check if metadata.race or metadata.class matches (including localized names)
              if (await variantMatchesRaceOrClass(variant, metadataObj, termObj)) {
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

              // Levenshtein match for linked Faction names (split by comma, then by words)
              if (linkedFactionNamesNormalized.length > 0) {
                const factionNames = linkedFactionNamesNormalized.split(',').map((n) => n.trim())
                for (const factionName of factionNames) {
                  if (factionName.length === 0) continue
                  const factionWords = factionName.split(/\s+/)
                  for (const word of factionWords) {
                    if (word.length === 0) continue
                    const factionLevDist = levenshtein(variant, word)
                    if (factionLevDist <= maxDist) {
                      termMatches = true
                      break
                    }
                  }
                  if (termMatches) break
                }
              }

              // Levenshtein match for linked Location names (split by comma, then by words)
              if (!termMatches && linkedLocationNamesNormalized.length > 0) {
                const locationNames = linkedLocationNamesNormalized.split(',').map((n) => n.trim())
                for (const locationName of locationNames) {
                  if (locationName.length === 0) continue
                  const locationWords = locationName.split(/\s+/)
                  for (const word of locationWords) {
                    if (word.length === 0) continue
                    const locationLevDist = levenshtein(variant, word)
                    if (locationLevDist <= maxDist) {
                      termMatches = true
                      break
                    }
                  }
                  if (termMatches) break
                }
              }

              // Levenshtein match for linked Lore names (split by comma, then by words)
              if (!termMatches && linkedLoreNamesNormalized.length > 0) {
                const loreNames = linkedLoreNamesNormalized.split(',').map((n) => n.trim())
                for (const loreName of loreNames) {
                  if (loreName.length === 0) continue
                  const loreWords = loreName.split(/\s+/)
                  for (const word of loreWords) {
                    if (word.length === 0) continue
                    const loreLevDist = levenshtein(variant, word)
                    if (loreLevDist <= maxDist) {
                      termMatches = true
                      break
                    }
                  }
                  if (termMatches) break
                }
              }

              if (termMatches) break
            }

            // If this term (and none of its variants) doesn't match, reject the NPC
            if (!termMatches) {
              shouldInclude = false
              break
            }
          }

          if (shouldInclude) {
            filtered.push(npc)
          }
        }
        scoredNpcs = filtered
      }

      // Step 3.5: Re-apply multi-word bonuses after filtering (for Levenshtein fallback results)
      // This ensures that multi-word Lore/Faction matches get properly ranked even when FTS5 returns 0 results
      if (parsedQuery.terms.length > 1) {
        scoredNpcs = scoredNpcs.map((npc) => {
          let adjustedScore = npc._final_score

          // Check multi-word faction match
          const linkedFactionNamesNormalized = normalizeText(npc.linked_faction_names || '')
          if (linkedFactionNamesNormalized.length > 0) {
            const allTermsInThisFaction = parsedQuery.terms.every((term) =>
              linkedFactionNamesNormalized.includes(normalizeText(term)),
            )
            if (allTermsInThisFaction) {
              adjustedScore -= 500 // HUGE bonus
            }
          }

          // Check multi-word lore match
          const linkedLoreNamesNormalized = normalizeText(npc.linked_lore_names || '')
          if (linkedLoreNamesNormalized.length > 0) {
            const allTermsInThisLore = parsedQuery.terms.every((term) =>
              linkedLoreNamesNormalized.includes(normalizeText(term)),
            )
            if (allTermsInThisLore) {
              adjustedScore -= 500 // HUGE bonus
            }
          }

          return {
            ...npc,
            _final_score: adjustedScore,
          }
        })
      }

      // Step 4: Sort by combined score and take top 50
      scoredNpcs.sort((a, b) => a._final_score - b._final_score)
      scoredNpcs = scoredNpcs.slice(0, 50)

      // Clean up scoring metadata
      npcs = scoredNpcs.map(({ fts_score, _lev_distance, _final_score, ...npc }) => npc)
    } catch (error) {
      // Fallback: If FTS5 fails, return empty (better than crashing)
      console.error('[NPC Search] FTS5 search failed:', error)
      npcs = []
    }
  } else {
    // No search query - return all NPCs for this campaign
    npcs = db
      .prepare(
        `
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
    `,
      )
      .all(entityType.id, campaignId) as NpcRow[]
  }

  // Parse metadata JSON
  return npcs.map((npc) => ({
    ...npc,
    metadata: npc.metadata ? JSON.parse(npc.metadata as string) : null,
  }))
})
