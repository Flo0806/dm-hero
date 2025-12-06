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
  'scroll',
  'key',
  'map',
  'gem',
  'clothing',
  'food',
  'drink',
  'mount',
  'container',
  'currency',
  'component',
  'poison',
  'vehicle',
  'trap',
  'banner',
  'jewelry',
  'figurine',
  'orb',
  'horn',
  'bag',
  'lantern',
  'rope',
  'mirror',
  'crystal',
  'idol',
  'totem',
  'relic',
  'ammunition',
  'material',
] as const

export type ItemType = (typeof ITEM_TYPES)[number]

// Item-to-NPC relation types (owner relations)
export const ITEM_OWNER_RELATION_TYPES = [
  'owns',
  'carries',
  'created',
  'stole',
  'found',
  'inherited',
  'guards',
  'seeks',
  'lost',
  'destroyed',
  'enchanted',
  'cursed',
] as const

export type ItemOwnerRelationType = (typeof ITEM_OWNER_RELATION_TYPES)[number]

// Item-to-Item relation types
export const ITEM_RELATION_TYPES = [
  'part_of',
  'set_with',
  'requires',
  'upgrades_to',
  'transforms_into',
  'complements',
  'counters',
  'contains',
] as const

export type ItemRelationType = (typeof ITEM_RELATION_TYPES)[number]

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
  type?: ItemType | null
  rarity?: ItemRarity | null
  value?: number | null
  currency_id?: number | null
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
  location_id?: number | null
  metadata: ItemMetadata | null
  created_at: string
  updated_at: string
  _counts?: ItemCounts
}
