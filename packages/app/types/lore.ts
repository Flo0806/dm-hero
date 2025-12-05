export const LORE_TYPES = [
  'object', // General objects and artifacts
  'plant', // Flora and vegetation
  'place', // Locations and geographical features
  'event', // Historical events and happenings
  'creature', // Beings and monsters
  'concept', // Abstract ideas and theories
  'magic', // Magical phenomena and spells
  'religion', // Deities, beliefs, and religious practices
  'ritual', // Ceremonies and rites
  'spell', // Individual spells and incantations
  'language', // Languages and scripts
  'custom', // Cultural customs and traditions
  'disease', // Plagues and illnesses
  'organization', // Groups and institutions
  'god', // Deities and divine beings
  'plane', // Planes of existence
  'race', // Peoples and species
  'war', // Conflicts and battles
  'discovery', // Scientific or magical discoveries
  'myth', // Myths and legends
  'secret', // Hidden knowledge
  'recipe', // Crafting recipes and formulas
  'lore', // General lore entries
  'knowledge', // Academic knowledge
  'tradition', // Cultural traditions
  'law', // Laws and regulations
  'symbol', // Symbols and insignias
  'calendar', // Calendars and timekeeping
  'song', // Songs and ballads
  'poem', // Poems and verses
  'riddle', // Riddles and puzzles
] as const

export type LoreType = (typeof LORE_TYPES)[number]

export interface LoreMetadata {
  type?: LoreType
  date?: string // Optional date for historical events (YYYY-MM-DD)
}

export interface LoreCounts {
  npcs: number
  items: number
  factions: number
  locations: number
  players: number
  documents: number
  images: number
}

export interface Lore {
  id: number
  name: string
  description: string | null
  image_url?: string | null
  location_id?: number | null
  metadata: LoreMetadata | null
  created_at: string
  updated_at: string
  _counts?: LoreCounts
}
