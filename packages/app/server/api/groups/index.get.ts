import { getDb } from '../../utils/db'
import { createApiError, ErrorCodes } from '../../utils/errors'
import { createLevenshtein } from '../../utils/levenshtein'
import { normalizeText } from '../../utils/normalize'
import type { EntityGroup } from '~~/types/group'

const levenshtein = createLevenshtein()

interface GroupRow {
  id: number
  campaign_id: number
  name: string
  description: string | null
  color: string | null
  icon: string | null
  created_at: string
  updated_at: string
  member_count: number
  member_names: string | null
}

interface ScoredGroup extends GroupRow {
  _score: number
  _matchType: 'name' | 'description' | 'member'
}

/**
 * GET /api/groups
 *
 * Returns groups for a campaign with optional fuzzy search.
 * Search includes: group name, description, AND member entity names.
 *
 * Query params:
 * - campaignId: required
 * - search: optional fuzzy search term
 */
export default defineEventHandler((event) => {
  const db = getDb()
  const query = getQuery(event)
  const campaignId = query.campaignId as string
  const search = query.search as string | undefined

  if (!campaignId) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.CAMPAIGN_ID_REQUIRED })
  }

  // Get all groups with member names (for search)
  const groups = db.prepare(`
    SELECT
      g.id,
      g.campaign_id,
      g.name,
      g.description,
      g.color,
      g.icon,
      g.created_at,
      g.updated_at,
      COUNT(DISTINCT CASE WHEN e.deleted_at IS NULL THEN gm.entity_id END) as member_count,
      GROUP_CONCAT(DISTINCT e.name) as member_names
    FROM entity_groups g
    LEFT JOIN entity_group_members gm ON gm.group_id = g.id
    LEFT JOIN entities e ON e.id = gm.entity_id AND e.deleted_at IS NULL
    WHERE g.campaign_id = ? AND g.deleted_at IS NULL
    GROUP BY g.id
  `).all(campaignId) as GroupRow[]

  // No search? Return all sorted by name
  if (!search || !search.trim()) {
    return formatResults(groups.sort((a, b) => a.name.localeCompare(b.name)))
  }

  // Apply fuzzy search
  const searchTerm = normalizeText(search.trim())
  const maxDist = getMaxDistance(searchTerm)

  const scoredGroups: ScoredGroup[] = []

  for (const group of groups) {
    const match = findBestMatch(group, searchTerm, maxDist)
    if (match) {
      scoredGroups.push({
        ...group,
        _score: match.score,
        _matchType: match.type,
      })
    }
  }

  // Sort by score (lower = better), then by match type priority, then by name
  scoredGroups.sort((a, b) => {
    // Match type priority: name > description > member
    const typePriority = { name: 0, description: 1, member: 2 }
    const typeDiff = typePriority[a._matchType] - typePriority[b._matchType]
    if (typeDiff !== 0) return typeDiff

    // Then by score (lower is better)
    const scoreDiff = a._score - b._score
    if (scoreDiff !== 0) return scoreDiff

    // Then alphabetically
    return a.name.localeCompare(b.name)
  })

  return formatResults(scoredGroups)
})

/**
 * Determine max Levenshtein distance based on search term length
 */
function getMaxDistance(searchTerm: string): number {
  if (searchTerm.length <= 3) return 1
  if (searchTerm.length <= 6) return 2
  return 3
}

/**
 * Find best fuzzy match in group's name, description, or member names
 * Returns match info or null if no match found
 */
function findBestMatch(
  group: GroupRow,
  searchTerm: string,
  maxDist: number,
): { score: number; type: 'name' | 'description' | 'member' } | null {
  // Check group name (highest priority)
  const nameScore = fuzzyScore(group.name, searchTerm, maxDist)
  if (nameScore !== null) {
    return { score: nameScore, type: 'name' }
  }

  // Check description
  if (group.description) {
    const descScore = fuzzyScore(group.description, searchTerm, maxDist)
    if (descScore !== null) {
      return { score: descScore, type: 'description' }
    }
  }

  // Check member names
  if (group.member_names) {
    const memberNames = group.member_names.split(',')
    let bestMemberScore: number | null = null

    for (const memberName of memberNames) {
      const score = fuzzyScore(memberName.trim(), searchTerm, maxDist)
      if (score !== null && (bestMemberScore === null || score < bestMemberScore)) {
        bestMemberScore = score
      }
    }

    if (bestMemberScore !== null) {
      return { score: bestMemberScore, type: 'member' }
    }
  }

  return null
}

/**
 * Calculate fuzzy match score for text against search term
 * Returns score (lower = better) or null if no match
 *
 * Checks:
 * 1. Exact substring match (score: 0)
 * 2. Full text Levenshtein distance
 * 3. Word-by-word Levenshtein distance
 */
function fuzzyScore(text: string, searchTerm: string, maxDist: number): number | null {
  const normalized = normalizeText(text)

  // Exact substring match = best score
  if (normalized.includes(searchTerm)) {
    return 0
  }

  // Full text Levenshtein
  const fullDist = levenshtein(searchTerm, normalized)
  if (fullDist <= maxDist) {
    return fullDist
  }

  // Word-by-word Levenshtein (for multi-word names like "Bernhard Müller")
  const words = normalized.split(/\s+/)
  let bestWordDist: number | null = null

  for (const word of words) {
    if (word.length < 2) continue
    const dist = levenshtein(searchTerm, word)
    if (dist <= maxDist && (bestWordDist === null || dist < bestWordDist)) {
      bestWordDist = dist
    }
  }

  return bestWordDist
}

/**
 * Format groups for API response
 */
function formatResults(groups: GroupRow[]): EntityGroup[] {
  return groups.map((g): EntityGroup => ({
    id: g.id,
    campaign_id: g.campaign_id,
    name: g.name,
    description: g.description,
    color: g.color,
    icon: g.icon,
    created_at: g.created_at,
    updated_at: g.updated_at,
    _counts: {
      total: g.member_count,
      byType: {},
    },
  }))
}
