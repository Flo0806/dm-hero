export const FACTION_TYPES = [
  'guild',
  'cult',
  'military',
  'criminal',
  'political',
  'religious',
  'academic',
  'merchant',
  'noble',
  'secret',
  'rebellion',
  'thieves',
  'knights',
  'monks',
  'tribal',
  'undead',
  'demon_cult',
  'explorers',
  'hunters',
  'healers',
  'entertainers',
  'rangers',
  'craftsmen',
  'seafarers',
  'smugglers',
  'slavers',
  'resistance',
  'inquisition',
  'elemental',
  'fey',
  'planar',
] as const

export type FactionType = (typeof FACTION_TYPES)[number]

export const FACTION_ALIGNMENTS = [
  'lawfulGood',
  'neutralGood',
  'chaoticGood',
  'lawfulNeutral',
  'trueNeutral',
  'chaoticNeutral',
  'lawfulEvil',
  'neutralEvil',
  'chaoticEvil',
  'unaligned',
] as const

export type FactionAlignment = (typeof FACTION_ALIGNMENTS)[number]

export const FACTION_MEMBERSHIP_TYPES = [
  'leader',
  'member',
  'founder',
  'ally',
  'enemy',
  'former',
  'spy',
  'agent',
  'advisor',
  'champion',
  'treasurer',
  'secretary',
  'ambassador',
  'prisoner',
  'patron',
  'benefactor',
  'enforcer',
  'initiate',
  'elder',
  'herald',
  'scribe',
  'guard',
  'informant',
  'supplier',
] as const

export type FactionMembershipType = (typeof FACTION_MEMBERSHIP_TYPES)[number]

// Faction-to-Location relation types
export const FACTION_LOCATION_TYPES = [
  'headquarters',
  'hideout',
  'meetingPlace',
  'territory',
  'safehouse',
  'baseOfOperations',
  'warehouse',
  'temple',
  'training_ground',
  'outpost',
  'embassy',
  'stronghold',
] as const

export type FactionLocationType = (typeof FACTION_LOCATION_TYPES)[number]

// Faction-to-Faction relation types
export const FACTION_RELATION_TYPES = [
  'allied',
  'hostile',
  'neutral',
  'rival',
  'vassal',
  'overlord',
  'trade_partner',
  'at_war',
  'truce',
  'secret_ally',
  'former_ally',
  'splinter',
  'parent_org',
  'subsidiary',
] as const

export type FactionRelationType = (typeof FACTION_RELATION_TYPES)[number]

export interface FactionMetadata {
  type?: FactionType | string
  alignment?: FactionAlignment | string
  headquarters?: string
  goals?: string
  notes?: string
}

export interface FactionCounts {
  members: number
  items: number
  locations: number
  lore: number
  players: number
  documents: number
  images: number
  relations: number
}

export interface Faction {
  id: number
  name: string
  description: string | null
  image_url?: string | null
  location_id?: number | null
  metadata: FactionMetadata | null
  leader_id?: number | null
  leader_name?: string | null
  created_at: string
  updated_at: string
  _counts?: FactionCounts
}
