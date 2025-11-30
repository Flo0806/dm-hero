export interface FactionMetadata {
  type?: string
  alignment?: string
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
}

export interface Faction {
  id: number
  name: string
  description: string | null
  image_url?: string | null
  metadata: FactionMetadata | null
  leader_id?: number | null
  leader_name?: string | null
  created_at: string
  updated_at: string
  _counts?: FactionCounts
}
