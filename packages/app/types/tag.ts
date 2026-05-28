/**
 * Tags for entity categorisation.
 *
 * Naming rules (enforced both client- and server-side):
 *  - lowercase a-z and ASCII hyphens only
 *  - no leading/trailing hyphen, no double hyphens
 *  - max 32 characters
 *  - the `#` prefix is added only in display + search parsing — never stored
 */

export interface Tag {
  id: number
  name: string
  color: string | null
  deleted_at?: string | null
}

export interface EntityWithTags {
  tags?: Tag[]
}

export const TAG_NAME_REGEX = /^[a-z]+(?:-[a-z]+)*$/
export const TAG_NAME_MAX_LENGTH = 32

/** Strict validation. Empty string is invalid. */
export function isValidTagName(name: string): boolean {
  if (!name || name.length > TAG_NAME_MAX_LENGTH) return false
  return TAG_NAME_REGEX.test(name)
}

/**
 * Normalise raw user input into a candidate tag name:
 *  - trim
 *  - strip a leading `#`
 *  - lowercase
 * Returns the candidate; caller still has to validate with `isValidTagName`.
 */
export function normaliseTagName(raw: string): string {
  return raw.trim().replace(/^#/, '').toLowerCase()
}

/** Preset color palette — 12 vetted colors that read against dark + light themes. */
export const TAG_COLORS = [
  '#D4A574', // gold (default)
  '#E57373', // soft red
  '#F06292', // pink
  '#BA68C8', // purple
  '#9575CD', // deep purple
  '#7986CB', // indigo
  '#64B5F6', // blue
  '#4DD0E1', // cyan
  '#4DB6AC', // teal
  '#81C784', // green
  '#DCE775', // lime
  '#FFB74D', // orange
] as const

export type TagColor = typeof TAG_COLORS[number]
export const DEFAULT_TAG_COLOR: TagColor = TAG_COLORS[0]

export function isValidTagColor(color: string): color is TagColor {
  return (TAG_COLORS as readonly string[]).includes(color)
}
