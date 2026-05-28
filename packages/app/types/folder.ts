/**
 * Entity folders — flat in phase 1, schema is nested-ready (parent_folder_id).
 *
 * Naming rule: a folder name is unique per (campaign, entity_type) regardless
 * of nesting depth. Conflicts on create/import are silently resolved by
 * appending `" (1)"`, `" (2)"`… via `uniqueFolderName`.
 *
 * `easter_egg` is an optional key from the animation pool (see FOLDER_EASTER_EGGS).
 */

export type EntityFolderType = 'npc' | 'item' | 'faction' | 'lore'

export const FOLDER_ENTITY_TYPES: readonly EntityFolderType[] = [
  'npc',
  'item',
  'faction',
  'lore',
] as const

export interface EntityFolder {
  id: number
  campaign_id: number
  entity_type: EntityFolderType
  name: string
  parent_folder_id: number | null
  color: string | null
  icon: string | null
  easter_egg: string | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface EntityFolderWithCount extends EntityFolder {
  entity_count: number
  /** child folders (phase 2). Always present, possibly empty. */
  children?: EntityFolderWithCount[]
}

/** Animation pool. Keys are stable — used as DB value and translation suffix. */
export const FOLDER_EASTER_EGGS = [
  'kobold',
  'snake',
  'spaceship',
  'fly',
  'eye',
  'candle',
  'dragon',
  'bones',
] as const

export type FolderEasterEgg = typeof FOLDER_EASTER_EGGS[number]

export function isValidEasterEgg(value: string | null | undefined): value is FolderEasterEgg {
  if (!value) return false
  return (FOLDER_EASTER_EGGS as readonly string[]).includes(value)
}

const MAX_FOLDER_NAME_LENGTH = 64

export function isValidFolderName(name: string): boolean {
  if (!name) return false
  const trimmed = name.trim()
  return trimmed.length > 0 && trimmed.length <= MAX_FOLDER_NAME_LENGTH
}

/**
 * Return a unique folder name within `existing` by appending " (N)" as needed.
 * Comparison is case-insensitive on the trimmed name.
 *
 *   uniqueFolderName(['Loot'], 'Loot') -> 'Loot (1)'
 *   uniqueFolderName(['Loot','Loot (1)'], 'Loot') -> 'Loot (2)'
 *   uniqueFolderName([], 'Loot') -> 'Loot'
 */
export function uniqueFolderName(existing: string[], desired: string): string {
  const base = desired.trim()
  const taken = new Set(existing.map(n => n.trim().toLowerCase()))
  if (!taken.has(base.toLowerCase())) return base
  let i = 1
  while (taken.has(`${base} (${i})`.toLowerCase())) i++
  return `${base} (${i})`
}
