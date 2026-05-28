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
