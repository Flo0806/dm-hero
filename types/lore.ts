export const LORE_TYPES = [
  'object', // General objects and artifacts
  'plant', // Flora and vegetation
  'place', // Locations and geographical features
  'event', // Historical events and happenings
  'creature', // Beings and monsters
  'concept', // Abstract ideas and theories
  'magic', // Magical phenomena and spells
  'religion', // Deities, beliefs, and religious practices
] as const

export type LoreType = typeof LORE_TYPES[number]

export interface LoreMetadata {
  type?: LoreType
  date?: string // Optional date for historical events (YYYY-MM-DD)
}

export interface Lore {
  id: number
  name: string
  description: string | null
  image_url?: string | null
  metadata: LoreMetadata | null
  created_at: string
  updated_at: string
}
