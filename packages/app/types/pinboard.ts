// Pinboard types for campaign-scoped quick entity access

export interface PinboardItem {
  pin_id: number
  display_order: number
  pinned_at: string
  id: number // entity_id or group_id
  name: string
  description: string | null
  image_url: string | null
  metadata: Record<string, unknown>
  type: 'npc' | 'location' | 'item' | 'faction' | 'lore' | 'player' | 'group'
  // For groups only
  color?: string | null
  icon?: string | null
  member_count?: number
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
  // For groups only
  color?: string | null
  icon?: string | null
  member_count?: number
}

export interface AddPinRequest {
  campaignId: number
  entityId?: number
  groupId?: number
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
