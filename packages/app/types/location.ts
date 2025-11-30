export interface LocationMetadata {
  type?: string
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
