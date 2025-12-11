export const NPC_TYPES = [
  'ally',
  'enemy',
  'neutral',
  'questgiver',
  'merchant',
  'guard',
  'noble',
  'commoner',
  'villain',
  'mentor',
  'companion',
  'informant',
  'innkeeper',
  'rival',
  'servant',
  'slave',
  'ruler',
  'steward',
  'spy',
  'healer',
  'scholar',
  'craftsman',
  'priest',
  'soldier',
  'thief',
  'bard',
  'farmer',
  'hunter',
  'mage',
  'knight',
  'assassin',
  'smuggler',
  'deity',
] as const

export type NpcType = (typeof NPC_TYPES)[number]

export const NPC_STATUSES = [
  'alive',
  'dead',
  'missing',
  'imprisoned',
  'unknown',
  'undead',
  'cursed',
  'petrified',
  'polymorphed',
  'possessed',
  'banished',
  'sleeping',
  'retired',
  'charmed',
  'paralyzed',
  'blinded',
  'deafened',
  'diseased',
  'insane',
  'exiled',
  'hiding',
  'traveling',
  'unconscious',
  'resurrected',
] as const

export type NpcStatus = (typeof NPC_STATUSES)[number]

// NPC-to-NPC relation types
export const NPC_RELATION_TYPES = [
  'ally',
  'enemy',
  'family',
  'friend',
  'rival',
  'mentor',
  'student',
  'colleague',
  'superior',
  'subordinate',
  'creator',
  'creation',
  'servant',
  'master',
  'spouse',
  'parent',
  'child',
  'sibling',
  'employer',
  'employee',
  'betrayer',
  'lover',
  'apprentice',
  'business_partner',
  'like_minded',
  'protector',
  'ward',
  'nemesis',
  'contact',
  'informant',
  'debtor',
  'creditor',
  'believesIn',
  'worships',
] as const

export type NpcRelationType = (typeof NPC_RELATION_TYPES)[number]

// NPC-to-Location relation types
export const NPC_LOCATION_RELATION_TYPES = [
  'livesIn',
  'worksAt',
  'visitsOften',
  'bornIn',
  'hidesIn',
  'owns',
  'searchesFor',
  'banishedFrom',
  'guards',
  'currentlyAt',
  'imprisonedIn',
  'rulesOver',
  'fledFrom',
  'hasConnectionTo',
  'diedIn',
  'trainedIn',
  'patrolsIn',
  'frequents',
  'avoids',
  'protects',
  'traveledTo',
] as const

export type NpcLocationRelationType = (typeof NPC_LOCATION_RELATION_TYPES)[number]

// NPC-to-Item relation types
export const NPC_ITEM_RELATION_TYPES = [
  'owns',
  'carries',
  'wields',
  'wears',
  'seeks',
  'guards',
  'stole',
  'lost',
  'created',
  'destroyed',
  'sold',
  'bought',
  'borrowed',
  'lent',
  'hides',
  'inherited',
  'gifted',
  'found',
  'enchanted',
  'repaired',
] as const

export type NpcItemRelationType = (typeof NPC_ITEM_RELATION_TYPES)[number]

export interface NpcMetadata {
  race?: string
  class?: string
  location?: string
  faction?: string
  relationship?: string
  type?: NpcType
  status?: NpcStatus
  age?: number
  gender?: string
  [key: string]: unknown // Index signature for convertMetadataToKeys compatibility
}

export interface NpcCounts {
  relations: number
  items: number
  locations: number
  documents: number
  images: number
  memberships: number
  lore: number
  notes: number
  players: number
  factionName: string | null
}

export interface NPC {
  id: number
  name: string
  description: string | null
  image_url?: string | null
  location_id?: number | null
  metadata: {
    race?: string
    class?: string
    location?: string
    faction?: string
    relationship?: string
    type?: NpcType
    status?: NpcStatus
    age?: number
    gender?: string
  } | null
  created_at: string
  updated_at: string
  // Async loaded counts (optional, loaded on demand)
  _counts?: NpcCounts
}
