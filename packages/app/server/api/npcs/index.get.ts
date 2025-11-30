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
    linked_npc_names?: string | null
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
        if (keys.length === 1 && keys[0]) {
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
      console.log('[NPC Search] Starting FTS5 query...')
      const ftsStart = Date.now()
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
          GROUP_CONCAT(DISTINCT lore.name) as linked_lore_names,
          GROUP_CONCAT(DISTINCT npc_out.name || '|' || npc_in.name) as linked_npc_names
        FROM entities_fts fts
        INNER JOIN entities e ON fts.rowid = e.id
        LEFT JOIN entity_relations faction_rel ON faction_rel.from_entity_id = e.id
        LEFT JOIN entities faction ON faction.id = faction_rel.to_entity_id AND faction.deleted_at IS NULL AND faction.type_id = (SELECT id FROM entity_types WHERE name = 'Faction')
        LEFT JOIN entity_relations location_rel ON location_rel.from_entity_id = e.id
        LEFT JOIN entities location ON location.id = location_rel.to_entity_id AND location.deleted_at IS NULL AND location.type_id = (SELECT id FROM entity_types WHERE name = 'Location')
        LEFT JOIN entity_relations lore_rel ON lore_rel.from_entity_id = e.id
        LEFT JOIN entities lore ON lore.id = lore_rel.to_entity_id AND lore.deleted_at IS NULL AND lore.type_id = (SELECT id FROM entity_types WHERE name = 'Lore')
        LEFT JOIN entity_relations npc_rel_out ON npc_rel_out.from_entity_id = e.id
        LEFT JOIN entities npc_out ON npc_out.id = npc_rel_out.to_entity_id AND npc_out.deleted_at IS NULL AND npc_out.type_id = (SELECT id FROM entity_types WHERE name = 'NPC')
        LEFT JOIN entity_relations npc_rel_in ON npc_rel_in.to_entity_id = e.id
        LEFT JOIN entities npc_in ON npc_in.id = npc_rel_in.from_entity_id AND npc_in.deleted_at IS NULL AND npc_in.type_id = (SELECT id FROM entity_types WHERE name = 'NPC')
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
      console.log(`[NPC Search] FTS5 query done in ${Date.now() - ftsStart}ms, found ${npcs.length} results`)
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
            GROUP_CONCAT(DISTINCT lore.name) as linked_lore_names,
            GROUP_CONCAT(DISTINCT npc_out.name || '|' || npc_in.name) as linked_npc_names
          FROM entities_fts fts
          INNER JOIN entities e ON fts.rowid = e.id
          LEFT JOIN entity_relations faction_rel ON faction_rel.from_entity_id = e.id
          LEFT JOIN entities faction ON faction.id = faction_rel.to_entity_id AND faction.deleted_at IS NULL AND faction.type_id = (SELECT id FROM entity_types WHERE name = 'Faction')
          LEFT JOIN entity_relations location_rel ON location_rel.from_entity_id = e.id
          LEFT JOIN entities location ON location.id = location_rel.to_entity_id AND location.deleted_at IS NULL AND location.type_id = (SELECT id FROM entity_types WHERE name = 'Location')
          LEFT JOIN entity_relations lore_rel ON lore_rel.from_entity_id = e.id
          LEFT JOIN entities lore ON lore.id = lore_rel.to_entity_id AND lore.deleted_at IS NULL AND lore.type_id = (SELECT id FROM entity_types WHERE name = 'Lore')
          LEFT JOIN entity_relations npc_rel_out ON npc_rel_out.from_entity_id = e.id
          LEFT JOIN entities npc_out ON npc_out.id = npc_rel_out.to_entity_id AND npc_out.deleted_at IS NULL AND npc_out.type_id = (SELECT id FROM entity_types WHERE name = 'NPC')
          LEFT JOIN entity_relations npc_rel_in ON npc_rel_in.to_entity_id = e.id
          LEFT JOIN entities npc_in ON npc_in.id = npc_rel_in.from_entity_id AND npc_in.deleted_at IS NULL AND npc_in.type_id = (SELECT id FROM entity_types WHERE name = 'NPC')
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
        console.log('[NPC Search] Starting full table scan...')
        const scanStart = Date.now()
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
            GROUP_CONCAT(DISTINCT lore.name) as linked_lore_names,
            GROUP_CONCAT(DISTINCT npc_out.name || '|' || npc_in.name) as linked_npc_names
          FROM entities e
          LEFT JOIN entity_relations faction_rel ON faction_rel.from_entity_id = e.id
          LEFT JOIN entities faction ON faction.id = faction_rel.to_entity_id AND faction.deleted_at IS NULL AND faction.type_id = (SELECT id FROM entity_types WHERE name = 'Faction')
          LEFT JOIN entity_relations location_rel ON location_rel.from_entity_id = e.id
          LEFT JOIN entities location ON location.id = location_rel.to_entity_id AND location.deleted_at IS NULL AND location.type_id = (SELECT id FROM entity_types WHERE name = 'Location')
          LEFT JOIN entity_relations lore_rel ON lore_rel.from_entity_id = e.id
          LEFT JOIN entities lore ON lore.id = lore_rel.to_entity_id AND lore.deleted_at IS NULL AND lore.type_id = (SELECT id FROM entity_types WHERE name = 'Lore')
          LEFT JOIN entity_relations npc_rel_out ON npc_rel_out.from_entity_id = e.id
          LEFT JOIN entities npc_out ON npc_out.id = npc_rel_out.to_entity_id AND npc_out.deleted_at IS NULL AND npc_out.type_id = (SELECT id FROM entity_types WHERE name = 'NPC')
          LEFT JOIN entity_relations npc_rel_in ON npc_rel_in.to_entity_id = e.id
          LEFT JOIN entities npc_in ON npc_in.id = npc_rel_in.from_entity_id AND npc_in.deleted_at IS NULL AND npc_in.type_id = (SELECT id FROM entity_types WHERE name = 'NPC')
          WHERE e.type_id = ?
            AND e.campaign_id = ?
            AND e.deleted_at IS NULL
          GROUP BY e.id
          ORDER BY e.name ASC
        `,
          )
          .all(entityType.id, campaignId) as NpcRow[]
        console.log(`[NPC Search] Full table scan done in ${Date.now() - scanStart}ms, found ${npcs.length} results`)
      }

      // Step 1.5: Separate Player lookup (fast, doesn't slow down main query)
      // Find all Players matching the search term, then get their linked NPC IDs
      const playerTypeId = db
        .prepare('SELECT id FROM entity_types WHERE name = ?')
        .get('Player') as { id: number } | undefined
      const npcIdsLinkedToMatchingPlayers = new Set<number>()

      if (playerTypeId) {
        // Find ALL Players, then filter with Levenshtein
        const allPlayers = db
          .prepare(
            `
          SELECT id, name FROM entities
          WHERE type_id = ? AND campaign_id = ? AND deleted_at IS NULL
        `,
          )
          .all(playerTypeId.id, campaignId) as Array<{
          id: number
          name: string
        }>

        // Filter with substring match OR Levenshtein distance
        const maxDist = searchTerm.length <= 3 ? 1 : searchTerm.length <= 6 ? 2 : 3
        const matchingPlayers = allPlayers.filter((player) => {
          const playerNameNormalized = normalizeText(player.name)
          // Substring match
          if (playerNameNormalized.includes(searchTerm)) return true
          // Levenshtein on full name
          if (levenshtein(searchTerm, playerNameNormalized) <= maxDist) return true
          // Levenshtein on each word of the name
          const words = playerNameNormalized.split(/\s+/)
          for (const word of words) {
            if (word.length < 3) continue
            if (levenshtein(searchTerm, word) <= maxDist) return true
          }
          return false
        })

        if (matchingPlayers.length > 0) {
          console.log(
            `[NPC Search] Found ${matchingPlayers.length} Players matching "${searchTerm}"`,
          )
          const playerIds = matchingPlayers.map((p) => p.id)

          // Find NPCs linked to these Players
          const linkedNpcs = db
            .prepare(
              `
            SELECT DISTINCT
              CASE
                WHEN er.from_entity_id IN (${playerIds.join(',')}) THEN er.to_entity_id
                ELSE er.from_entity_id
              END as npc_id
            FROM entity_relations er
            WHERE (er.from_entity_id IN (${playerIds.join(',')}) OR er.to_entity_id IN (${playerIds.join(',')}))
          `,
            )
            .all() as Array<{ npc_id: number }>

          for (const row of linkedNpcs) {
            npcIdsLinkedToMatchingPlayers.add(row.npc_id)
          }
          console.log(
            `[NPC Search] Found ${npcIdsLinkedToMatchingPlayers.size} NPCs linked to matching Players`,
          )
        }
      }

      // Step 2: Apply Levenshtein distance for better ranking
      console.log('[NPC Search] Starting scoring...')
      let scoredNpcs = npcs.map((npc: NpcRow): ScoredNpc => {
        const nameNormalized = normalizeText(npc.name)

        // Smart distance calculation
        const exactMatch = nameNormalized === searchTerm
        const startsWithQuery = nameNormalized.startsWith(searchTerm)
        const containsQuery = nameNormalized.includes(searchTerm)

        // Check if search term appears in metadata, description, linked factions, linked locations, linked lore, or linked players (FTS5 match but not in name)
        const metadataNormalized = normalizeText(npc.metadata || '')
        const descriptionNormalized = normalizeText(npc.description || '')
        const linkedFactionNamesNormalized = normalizeText(npc.linked_faction_names || '')
        const linkedLocationNamesNormalized = normalizeText(npc.linked_location_names || '')
        const linkedLoreNamesNormalized = normalizeText(npc.linked_lore_names || '')
        const linkedNpcNamesNormalized = normalizeText(npc.linked_npc_names || '')
        const isMetadataMatch = metadataNormalized.includes(searchTerm)
        const isDescriptionMatch = descriptionNormalized.includes(searchTerm)
        const isFactionMatch = linkedFactionNamesNormalized.includes(searchTerm)
        const isLocationMatch = linkedLocationNamesNormalized.includes(searchTerm)
        const isLoreMatch = linkedLoreNamesNormalized.includes(searchTerm)
        const isNpcMatch = linkedNpcNamesNormalized.includes(searchTerm)
        const isPlayerMatch = npcIdsLinkedToMatchingPlayers.has(npc.id)
        const isNonNameMatch =
          (isMetadataMatch ||
            isDescriptionMatch ||
            isFactionMatch ||
            isLocationMatch ||
            isLoreMatch ||
            isNpcMatch ||
            isPlayerMatch) &&
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
        if (isPlayerMatch) finalScore -= 30 // Player matches are very good
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

        // SPECIAL: Multi-word NPC relation match bonus
        // Check if ALL terms from parsedQuery appear in this NPC's linked NPC names
        if (parsedQuery.terms.length > 1 && linkedNpcNamesNormalized.length > 0) {
          const allTermsInThisNpc = parsedQuery.terms.every((term) =>
            linkedNpcNamesNormalized.includes(normalizeText(term)),
          )
          if (allTermsInThisNpc) {
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

        // Check if the variant matches the race/class key directly (exact or fuzzy)
        if (raceKey) {
          const raceKeyNormalized = normalizeText(raceKey)
          if (
            raceKeyNormalized === variant ||
            raceKeyNormalized.includes(variant) ||
            variant.includes(raceKeyNormalized)
          ) {
            return true
          }
        }
        if (classKey) {
          const classKeyNormalized = normalizeText(classKey)
          if (
            classKeyNormalized === variant ||
            classKeyNormalized.includes(variant) ||
            variant.includes(classKeyNormalized)
          ) {
            return true
          }
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
          const linkedNpcNamesNormalized = normalizeText(npc.linked_npc_names || '')

          // Check if EXACT phrase appears in ANY field OR NPC is linked to matching Player
          return (
            nameNormalized.includes(exactPhrase) ||
            descriptionNormalized.includes(exactPhrase) ||
            metadataNormalized.includes(exactPhrase) ||
            linkedFactionNamesNormalized.includes(exactPhrase) ||
            linkedLocationNamesNormalized.includes(exactPhrase) ||
            linkedLoreNamesNormalized.includes(exactPhrase) ||
            linkedNpcNamesNormalized.includes(exactPhrase) ||
            npcIdsLinkedToMatchingPlayers.has(npc.id)
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
          const linkedNpcNamesNormalized = normalizeText(npc.linked_npc_names || '')

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
                termObj.variants.some((variant) => linkedLoreNamesNormalized.includes(variant) ||
                  linkedNpcNamesNormalized.includes(variant)),
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
                  linkedLoreNamesNormalized.includes(variant) ||
                  linkedNpcNamesNormalized.includes(variant) ||
                  npcIdsLinkedToMatchingPlayers.has(npc.id)
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

                // Levenshtein match for linked NPC names (split by |, then by words)
                if (!shouldInclude && linkedNpcNamesNormalized.length > 0) {
                  const npcNames = linkedNpcNamesNormalized.split('|').map((n) => n.trim())
                  for (const npcName of npcNames) {
                    if (npcName.length === 0) continue
                    const npcWords = npcName.split(/\s+/)
                    for (const word of npcWords) {
                      if (word.length === 0) continue
                      const npcLevDist = levenshtein(variant, word)
                      if (npcLevDist <= maxDist) {
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
          const linkedNpcNamesNormalized = normalizeText(npc.linked_npc_names || '')

          // Parse metadata to check race/class with localized names
          let metadataObj: Pick<NpcMetadata, 'race' | 'class'> | null = null
          try {
            metadataObj = npc.metadata ? JSON.parse(npc.metadata) : null
          } catch {
            // Invalid JSON - fallback to string search
          }

          // Check if NPC is linked to a matching Player
          let shouldInclude = npcIdsLinkedToMatchingPlayers.has(npc.id)

          // Check if at least one term (or its variants) matches
          for (let i = 0; i < parsedQuery.terms.length; i++) {
            const termObj = expandedTerms[i]
            if (!termObj) continue
            const shouldCheckMetadata = !termObj.blockMetadata

            // Check if ANY variant matches
            for (const variant of termObj.variants) {
              // Check if variant appears in any field
              if (
                nameNormalized.includes(variant) ||
                descriptionNormalized.includes(variant) ||
                linkedFactionNamesNormalized.includes(variant) ||
                linkedLocationNamesNormalized.includes(variant) ||
                linkedLoreNamesNormalized.includes(variant) ||
                linkedNpcNamesNormalized.includes(variant)
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

              // Levenshtein match for linked NPC names (split by |, then by words)
              if (!shouldInclude && linkedNpcNamesNormalized.length > 0) {
                const npcNames = linkedNpcNamesNormalized.split('|').map((n) => n.trim())
                for (const npcName of npcNames) {
                  if (npcName.length === 0) continue
                  const npcWords = npcName.split(/\s+/)
                  for (const word of npcWords) {
                    if (word.length === 0) continue
                    const npcLevDist = levenshtein(variant, word)
                    if (npcLevDist <= maxDist) {
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
          const linkedNpcNamesNormalized = normalizeText(npc.linked_npc_names || '')

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
            if (!termObj) continue
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
                linkedLoreNamesNormalized.includes(variant) ||
                linkedNpcNamesNormalized.includes(variant) ||
                npcIdsLinkedToMatchingPlayers.has(npc.id)
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

              // Levenshtein match for linked NPC names (split by |, then by words)
              if (!termMatches && linkedNpcNamesNormalized.length > 0) {
                const npcNames = linkedNpcNamesNormalized.split('|').map((n) => n.trim())
                for (const npcName of npcNames) {
                  if (npcName.length === 0) continue
                  const npcWords = npcName.split(/\s+/)
                  for (const word of npcWords) {
                    if (word.length === 0) continue
                    const npcLevDist = levenshtein(variant, word)
                    if (npcLevDist <= maxDist) {
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

          // Check multi-word NPC relation match
          const linkedNpcNamesNormalized = normalizeText(npc.linked_npc_names || '')
          if (linkedNpcNamesNormalized.length > 0) {
            const allTermsInThisNpc = parsedQuery.terms.every((term) =>
              linkedNpcNamesNormalized.includes(normalizeText(term)),
            )
            if (allTermsInThisNpc) {
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
      npcs = scoredNpcs.map(({ fts_score: _fts_score, _lev_distance, _final_score, ...npc }) => npc)
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
