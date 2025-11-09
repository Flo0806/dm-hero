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
] as const

export type NpcType = (typeof NPC_TYPES)[number]

export const NPC_STATUSES = ['alive', 'dead', 'missing', 'imprisoned', 'unknown'] as const

export type NpcStatus = (typeof NPC_STATUSES)[number]

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
}

export interface NpcCounts {
  relations: number
  items: number
  locations: number
  documents: number
  images: number
  memberships: number
  factionName: string | null
}

export interface NPC {
  id: number
  name: string
  description: string | null
  image_url?: string | null
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
