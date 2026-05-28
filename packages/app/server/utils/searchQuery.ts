import type Database from 'better-sqlite3'
import { normaliseTagName, isValidTagName } from '../../types/tag'

export interface ExtractedTags {
  /** lowercase tag names (no `#`), deduplicated, validated */
  tags: string[]
  /** the remaining text after tag tokens are removed, trimmed */
  rest: string
}

/**
 * Pull \`#tag\` tokens out of a search input.
 *
 * Tags are removed from the string; the remainder is returned untouched so
 * callers can hand it to the existing FTS5 parser (parseSearchQuery from
 * search-query-parser.ts) without further changes.
 *
 *   "#kuh #grumpy Holger AND ork" → { tags: ['kuh','grumpy'], rest: 'Holger AND ork' }
 *   "Holger"                       → { tags: [], rest: 'Holger' }
 */
export function extractTagFilters(input: string | undefined | null): ExtractedTags {
  if (!input) return { tags: [], rest: '' }

  const tokens = input.trim().split(/\s+/)
  const tags = new Set<string>()
  const restParts: string[] = []

  for (const token of tokens) {
    if (token.startsWith('#') && token.length > 1) {
      const name = normaliseTagName(token)
      if (isValidTagName(name)) {
        tags.add(name)
        continue
      }
    }
    if (token) restParts.push(token)
  }

  return { tags: [...tags], rest: restParts.join(' ') }
}

/**
 * Resolve a list of tag names to the set of entity ids that have ALL of them
 * (AND-combined). Returns an empty set if any name doesn't exist; callers
 * typically `return []` early in that case.
 */
export function resolveTagFilter(db: Database.Database, tagNames: string[]): Set<number> {
  // De-dupe defensively — HAVING COUNT(DISTINCT t.id) compares against the
  // unique count, so a duplicate name in the input would produce a false miss.
  const uniqueTags = [...new Set(tagNames)]
  if (uniqueTags.length === 0) return new Set()
  const placeholders = uniqueTags.map(() => '?').join(',')
  const rows = db.prepare(`
    SELECT et.entity_id
    FROM entity_tags et
    JOIN tags t ON t.id = et.tag_id
    WHERE t.name IN (${placeholders}) AND t.deleted_at IS NULL
    GROUP BY et.entity_id
    HAVING COUNT(DISTINCT t.id) = ?
  `).all(...uniqueTags, uniqueTags.length) as Array<{ entity_id: number }>
  return new Set(rows.map(r => r.entity_id))
}
