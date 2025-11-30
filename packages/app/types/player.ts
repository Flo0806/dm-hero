export interface PlayerMetadata {
  player_name?: string | null // Real name of the player (Spielername)
  inspiration?: number // DM inspiration counter
  email?: string | null
  phone?: string | null
  discord?: string | null
  notes?: string | null
  [key: string]: unknown
}

export interface PlayerCounts {
  characters: number // NPCs controlled by this player
  items: number
  locations: number
  factions: number
  lore: number
  sessions: number
  documents: number
  images: number
}

export interface Player {
  id: number
  name: string
  description: string | null
  image_url?: string | null
  metadata: PlayerMetadata | null
  created_at: string
  updated_at: string
  _counts?: PlayerCounts
}
