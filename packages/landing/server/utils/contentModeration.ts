/**
 * Content Moderation Utility
 * Checks text for forbidden content (racism, abuse, child exploitation)
 *
 * Categories:
 * - racism: Racial slurs and hate speech
 * - abuse: Sexual abuse, exploitation
 * - child: Child exploitation, pedophilia
 * - violence_extreme: Extreme glorified violence (not fantasy combat)
 */

export type ViolationCategory = 'racism' | 'abuse' | 'child' | 'violence_extreme'

export interface ContentViolation {
  category: ViolationCategory
  term: string
  field: string
}

// Forbidden terms by category (lowercase for matching)
// This list is intentionally not exhaustive - it catches obvious violations
// Terms are partially obscured in code but matched in full
const FORBIDDEN_TERMS: Record<ViolationCategory, string[]> = {
  racism: [
    // English slurs
    'nigger', 'nigga', 'n1gger', 'n1gga',
    'kike', 'k1ke',
    'spic', 'sp1c',
    'chink', 'ch1nk',
    'wetback',
    'gook',
    'raghead',
    'towelhead',
    'sandnigger',
    'coon',
    'darkie',
    'porch monkey',
    'jungle bunny',
    // German slurs
    'neger', 'kanake', 'kanacke', 'kümmeltürke', 'kümmel türke',
    'zigeuner', 'ziegenficker',
    'scheiß ausländer', 'scheiss ausländer',
    'scheiß juden', 'scheiss juden',
    'judenschwein', 'juden schwein',
  ],
  abuse: [
    // Sexual abuse terms
    'rape', 'raping', 'raped',
    'vergewaltigung', 'vergewaltigen', 'vergewaltigt',
    'molestation', 'molest',
    'sexual assault',
    'sexueller missbrauch', 'sexueller übergriff',
    'forced sex', 'erzwungener sex',
  ],
  child: [
    // Child exploitation - zero tolerance
    'pedophile', 'pedophil', 'pädophil', 'paedophile',
    'child porn', 'kinderporno', 'kinder porno',
    'child sex', 'kindersex', 'kinder sex',
    'minor sex', 'sex mit minderjährigen',
    'lolita',
    'underage sex',
    'child abuse', 'kindesmissbrauch', 'kindes missbrauch',
    'kid fuck', 'kinder ficken',
  ],
  violence_extreme: [
    // Glorified extreme violence (different from fantasy combat)
    'torture porn', 'folterporno', 'folter porno',
    'snuff',
    'real murder', 'echter mord',
    'genocide tutorial', 'völkermord anleitung',
  ],
}

// Compile regex patterns for efficient matching
const PATTERNS: Map<ViolationCategory, RegExp[]> = new Map()

for (const [category, terms] of Object.entries(FORBIDDEN_TERMS)) {
  const patterns = terms.map((term) => {
    // Escape special regex characters
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Use word boundary at START only - allows matching German compound words
    // e.g., "vergewaltigung" matches in "Vergewaltigungsding"
    // But still prevents false positives like "grapefruit" matching "rape"
    return new RegExp(`\\b${escaped}`, 'i')
  })
  PATTERNS.set(category as ViolationCategory, patterns)
}

/**
 * Check text for forbidden content
 * @param text Text to check
 * @param field Field name for error reporting
 * @returns Array of violations found
 */
export function checkContent(text: string, field: string): ContentViolation[] {
  if (!text) return []

  const violations: ContentViolation[] = []
  const normalizedText = text.toLowerCase()

  for (const [category, patterns] of PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(normalizedText)) {
        // Find the actual matched term
        const match = normalizedText.match(pattern)
        if (match) {
          violations.push({
            category,
            term: match[0],
            field,
          })
          // Only report first violation per category per field
          break
        }
      }
    }
  }

  return violations
}

/**
 * Check multiple text fields
 * @param fields Object with field names as keys and text as values
 * @returns Array of all violations found
 */
export function checkMultipleFields(fields: Record<string, string | null | undefined>): ContentViolation[] {
  const allViolations: ContentViolation[] = []

  for (const [field, text] of Object.entries(fields)) {
    if (text) {
      const violations = checkContent(text, field)
      allViolations.push(...violations)
    }
  }

  return allViolations
}

/**
 * Get human-readable category name
 */
export function getCategoryLabel(category: ViolationCategory, locale: string = 'en'): string {
  const labels: Record<ViolationCategory, Record<string, string>> = {
    racism: { en: 'Racist content', de: 'Rassistischer Inhalt' },
    abuse: { en: 'Abuse-related content', de: 'Missbrauchsbezogener Inhalt' },
    child: { en: 'Child exploitation', de: 'Kindesmissbrauch' },
    violence_extreme: { en: 'Extreme violence', de: 'Extreme Gewalt' },
  }
  return labels[category][locale] || labels[category].en
}
