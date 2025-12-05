// Campaign Map types

export interface CampaignMap {
  id: number
  campaign_id: number
  name: string
  description: string | null
  image_url: string
  parent_map_id: number | null
  version_name: string | null
  default_zoom: number
  min_zoom: number
  max_zoom: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  // Computed
  _markerCount?: number
  _versions?: CampaignMap[]
}

export interface MapMarker {
  id: number
  map_id: number
  entity_id: number
  x: number // Position as percentage (0-100)
  y: number // Position as percentage (0-100)
  custom_icon: string | null
  custom_color: string | null
  custom_label: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Joined from entities table
  entity_name?: string
  entity_type?: string
  entity_type_id?: number
  entity_image_url?: string | null
  entity_description?: string | null
}

export interface CreateMapPayload {
  name: string
  description?: string | null
  image_url: string
  parent_map_id?: number | null
  version_name?: string | null
  default_zoom?: number
  min_zoom?: number
  max_zoom?: number
}

export interface UpdateMapPayload {
  name?: string
  description?: string | null
  parent_map_id?: number | null
  version_name?: string | null
  default_zoom?: number
  min_zoom?: number
  max_zoom?: number
}

export interface CreateMarkerPayload {
  entity_id: number
  x: number
  y: number
  custom_icon?: string | null
  custom_color?: string | null
  custom_label?: string | null
  notes?: string | null
}

export interface UpdateMarkerPayload {
  x?: number
  y?: number
  custom_icon?: string | null
  custom_color?: string | null
  custom_label?: string | null
  notes?: string | null
}

// Entity type helpers for markers
export const ENTITY_TYPE_ICONS: Record<string, string> = {
  NPC: 'mdi-account',
  Location: 'mdi-map-marker',
  Item: 'mdi-sword',
  Faction: 'mdi-shield',
  Lore: 'mdi-book-open-variant',
  Player: 'mdi-account-star',
}

export const ENTITY_TYPE_COLORS: Record<string, string> = {
  NPC: '#D4A574',
  Location: '#8B7355',
  Item: '#CC8844',
  Faction: '#7B92AB',
  Lore: '#9C6B98',
  Player: '#4CAF50',
}
