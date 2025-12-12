// Pinboard types for campaign-scoped quick entity access

export interface PinboardItem {
  pin_id: number
  display_order: number
  pinned_at: string
  id: number // entity_id
  name: string
  description: string | null
  image_url: string | null
  metadata: Record<string, unknown>
  type: 'npc' | 'location' | 'item' | 'faction' | 'lore' | 'player'
}

// Raw database row before metadata parsing
export interface PinboardDbRow {
  pin_id: number
  display_order: number
  pinned_at: string
  id: number
  name: string
  description: string | null
  image_url: string | null
  metadata: string | null
  type: string
}

export interface AddPinRequest {
  campaignId: number
  entityId: number
}

export interface AddPinResponse {
  success: boolean
  pinId: number | bigint
  displayOrder: number
}

export interface ReorderPinsRequest {
  pinIds: number[]
}

export interface SuccessResponse {
  success: boolean
}
