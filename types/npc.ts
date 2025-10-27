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

export type NpcType = typeof NPC_TYPES[number]

export interface NpcMetadata {
  race?: string
  class?: string
  location?: string
  faction?: string
  relationship?: string
  type?: NpcType
}
