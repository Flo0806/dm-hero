export const ITEM_TYPES = [
  'weapon',
  'armor',
  'potion',
  'artifact',
  'quest_item',
  'consumable',
  'magical',
  'mundane',
  'tool',
  'treasure',
] as const

export type ItemType = (typeof ITEM_TYPES)[number]

export const ITEM_RARITIES = [
  'common',
  'uncommon',
  'rare',
  'very_rare',
  'legendary',
  'artifact',
] as const

export type ItemRarity = (typeof ITEM_RARITIES)[number]

export interface ItemMetadata {
  type?: ItemType | string | null
  rarity?: ItemRarity | string | null
  value?: number | null
  weight?: number | null
  attunement?: boolean
  damage?: string
  armor_class?: number
  charges?: string
  properties?: string
  notes?: string
  [key: string]: unknown
}

export interface ItemCounts {
  owners: number
  locations: number
  factions: number
  lore: number
  players: number
  documents: number
  images: number
}

export interface Item {
  id: number
  name: string
  description: string | null
  image_url?: string | null
  metadata: ItemMetadata | null
  created_at: string
  updated_at: string
  _counts?: ItemCounts
}
