export const LOCATION_TYPES = [
  'city',
  'town',
  'village',
  'castle',
  'dungeon',
  'forest',
  'mountain',
  'cave',
  'temple',
  'ruins',
  'tavern',
  'shop',
  'guild',
  'tower',
  'river',
  'lake',
  'swamp',
  'desert',
  'island',
  'bridge',
  'farm',
  'mine',
  'graveyard',
  'shrine',
  'camp',
  'battlefield',
  'monument',
  'waterfall',
  'portal',
  'manor',
  'fortress',
  'arena',
  'road',
  'valley',
  'coast',
  'oasis',
  'glacier',
  'volcano',
  'canyon',
  'plains',
  'jungle',
  'crypt',
  'palace',
  'monastery',
  'lighthouse',
  'windmill',
  'quarry',
] as const

export type LocationType = (typeof LOCATION_TYPES)[number]

// Location-to-Item relation types
export const LOCATION_ITEM_RELATION_TYPES = [
  'contains',
  'hidden',
  'displayed',
  'stored',
  'lost',
  'guarded',
  'buried',
  'mounted',
  'locked',
  'trapped',
  'cursed',
  'enchanted',
  'sold',
  'crafted',
  'discovered',
  'abandoned',
] as const

export type LocationItemRelationType = (typeof LOCATION_ITEM_RELATION_TYPES)[number]

export interface LocationMetadata {
  type?: LocationType | string
  region?: string
  notes?: string
}

export interface LocationCounts {
  npcs: number
  items: number
  lore: number
  players: number
  documents: number
  images: number
}

export interface Location {
  id: number
  name: string
  description: string | null
  image_url?: string | null
  parent_entity_id?: number | null
  metadata: LocationMetadata | null
  created_at: string
  updated_at: string
  _counts?: LocationCounts
}
