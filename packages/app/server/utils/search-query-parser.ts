/**
 * Parse search query with operators:
 * - "term1 AND term2" or "term1+term2" → AND (both must match)
 * - "term1 OR term2" or "term1|term2" → OR (either matches)
 * - "NOT term" or "-term" → NOT (exclude)
 * - "term" → Simple term (exact or prefix match)
 * - "\"exact phrase\"" → Exact phrase match
 */

export interface ParsedQuery {
  fts5Query: string
  terms: string[]
  hasOperators: boolean
  useExactFirst: boolean
}

export function parseSearchQuery(query: string): ParsedQuery {
  const trimmed = query.trim()

  // Check for operators BEFORE normalization
  const hasAnd = /\s+AND\s+/i.test(trimmed) || /\s+\+\s+/.test(trimmed)
  const hasOr = /\s+OR\s+/i.test(trimmed) || /\s+\|\s+/.test(trimmed)
  const hasNot = /\s+NOT\s+/i.test(trimmed) || /\s+-\s+/.test(trimmed) || trimmed.startsWith('NOT ') || trimmed.startsWith('- ')
  const hasQuotes = trimmed.includes('"')

  const hasOperators = hasAnd || hasOr || hasNot || hasQuotes

  if (!hasOperators) {
    // Simple query WITHOUT quotes: split into words for multi-word matching
    // (e.g., "die grauen jäger" → ["die", "grauen", "jäger"])
    const words = trimmed.split(/\s+/).filter((w) => w.length > 0)

    return {
      fts5Query: trimmed,
      terms: words,
      hasOperators: false,
      useExactFirst: true,
    }
  }

  // Special case: Quoted phrase only (e.g., "die grauen jäger")
  if (hasQuotes && !hasAnd && !hasOr && !hasNot) {
    const quoteMatch = trimmed.match(/"([^"]+)"/)
    if (quoteMatch && quoteMatch[1]) {
      const phrase = quoteMatch[1]
      // Split phrase into words for cross-entity search (Lore, Faction, Location names)
      // This allows "böser frosch" to match NPCs linked to Lore "Böser Frosch"
      const words = phrase.split(/\s+/).filter((w) => w.length > 0)
      return {
        fts5Query: `"${phrase}"`,
        terms: words, // Split into words for Levenshtein cross-search
        hasOperators: true,
        useExactFirst: true,
      }
    }
  }

  // Parse complex query
  const fts5Parts: string[] = []
  const terms: string[] = []

  // Split by spaces, but preserve quoted strings
  const tokens = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) || []

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]?.trim()

    if (!token) continue

    // Skip operator tokens (they'll be handled when processing the previous term)
    const tokenUpper = token.toUpperCase()
    if (tokenUpper === 'AND' || tokenUpper === 'OR' || tokenUpper === 'NOT' || token === '+' || token === '|' || token === '-') {
      continue
    }

    // Handle quoted phrases
    if (token.startsWith('"') && token.endsWith('"')) {
      const phrase = token.slice(1, -1)
      fts5Parts.push(`"${phrase}"`)
      terms.push(phrase)

      // Check for operator after quoted phrase
      const nextToken = tokens[i + 1]
      if (nextToken) {
        const nextUpper = nextToken.toUpperCase()
        if (nextUpper === 'AND' || nextToken === '+') {
          fts5Parts.push('AND')
        } else if (nextUpper === 'OR' || nextToken === '|') {
          fts5Parts.push('OR')
        }
      }
      continue
    }

    // Handle NOT prefix
    if (token.startsWith('-')) {
      const term = token.slice(1)
      if (term) {
        fts5Parts.push(`NOT ${term}`)
      }
      continue
    }

    // Check what comes BEFORE this token (for NOT operator)
    if (i > 0) {
      const prevToken = tokens[i - 1]
      const prevUpper = prevToken?.toUpperCase()
      if (prevUpper === 'NOT' || prevToken === '-') {
        fts5Parts.push(`NOT ${token}`)
        continue
      }
    }

    // Regular term - add with wildcard
    fts5Parts.push(`${token}*`)
    terms.push(token)

    // Check for operator after this token
    const nextToken = tokens[i + 1]
    if (nextToken) {
      const nextUpper = nextToken.toUpperCase()
      if (nextUpper === 'AND' || nextToken === '+') {
        fts5Parts.push('AND')
      } else if (nextUpper === 'OR' || nextToken === '|') {
        fts5Parts.push('OR')
      }
    }
  }

  return {
    fts5Query: fts5Parts.join(' '),
    terms,
    hasOperators: true,
    useExactFirst: false, // Complex queries use as-is
  }
}
