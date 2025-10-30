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
  let trimmed = query.trim()

  // Normalize operators: add spaces around symbols for consistent parsing
  trimmed = trimmed
    .replace(/\+/g, ' + ') // "a+b" → "a + b"
    .replace(/\|/g, ' | ') // "a|b" → "a | b"
    .replace(/\s+AND\s+/gi, ' + ')
    .replace(/\s+OR\s+/gi, ' | ')
    .replace(/\s+NOT\s+/gi, ' - ')
    .replace(/\s+/g, ' ') // Normalize multiple spaces

  // Check for operators
  const hasAnd = trimmed.includes('+')
  const hasOr = trimmed.includes('|')
  const hasNot = trimmed.includes('-')
  const hasQuotes = trimmed.includes('"')

  const hasOperators = hasAnd || hasOr || hasNot || hasQuotes

  if (!hasOperators) {
    // Simple query: try exact match first
    return {
      fts5Query: trimmed,
      terms: [trimmed],
      hasOperators: false,
      useExactFirst: true,
    }
  }

  // Parse complex query
  const fts5Parts: string[] = []
  const terms: string[] = []

  // Split by spaces, but preserve quoted strings
  const tokens = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) || []

  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i].trim()

    if (!token) continue

    // Handle quoted phrases
    if (token.startsWith('"') && token.endsWith('"')) {
      const phrase = token.slice(1, -1)
      fts5Parts.push(`"${phrase}"`)
      terms.push(phrase)
      continue
    }

    // Handle NOT operator (prefix)
    if (token.startsWith('-')) {
      const term = token.slice(1)
      if (term) {
        fts5Parts.push(`NOT ${term}`)
      }
      continue
    }

    // Handle standalone NOT operator
    if (token.toUpperCase() === 'NOT') {
      const nextToken = tokens[i + 1]
      if (nextToken) {
        fts5Parts.push(`NOT ${nextToken}`)
        i++ // Skip the next token
      }
      continue
    }

    // Check for operators after this token
    const nextToken = tokens[i + 1]

    if (nextToken === '+' || nextToken?.toUpperCase() === 'AND') {
      // AND operator - add prefix wildcard for typo tolerance
      fts5Parts.push(`${token}*`)
      fts5Parts.push('AND')
      terms.push(token)
      i++ // Skip the operator token
      continue
    }

    if (nextToken === '|' || nextToken?.toUpperCase() === 'OR') {
      // OR operator - add prefix wildcard for typo tolerance
      fts5Parts.push(`${token}*`)
      fts5Parts.push('OR')
      terms.push(token)
      i++ // Skip the operator token
      continue
    }

    // Default: simple term (implicit OR between terms) - add prefix wildcard
    fts5Parts.push(`${token}*`)
    terms.push(token)
  }

  return {
    fts5Query: fts5Parts.join(' '),
    terms,
    hasOperators: true,
    useExactFirst: false, // Complex queries use as-is
  }
}
