// Icon suggestions for groups (all verified MDI icons)
export const GROUP_ICONS = [
  'mdi-castle',
  'mdi-pine-tree',
  'mdi-city',
  'mdi-treasure-chest',
  'mdi-sword-cross',
  'mdi-skull',
  'mdi-crown',
  'mdi-book-open-page-variant',
  'mdi-shield-account',
  'mdi-compass',
  'mdi-map-marker-radius',
  'mdi-script-text',
  'mdi-church',
  'mdi-fire',
  'mdi-water',
  'mdi-lightning-bolt',
  'mdi-image-filter-hdr',
  'mdi-bridge',
  'mdi-home-group',
  'mdi-account-group',
] as const

export type GroupIcon = (typeof GROUP_ICONS)[number]

// Default colors for quick selection
export const GROUP_COLORS = [
  '#D4A574', // Gold (primary)
  '#8B7355', // Brown (secondary)
  '#7B92AB', // Steel blue
  '#CC8844', // Orange
  '#6B8E23', // Olive
  '#8B4513', // Saddle brown
  '#CD5C5C', // Indian red
  '#708090', // Slate gray
  '#4682B4', // Steel blue
  '#9370DB', // Medium purple
] as const

export type GroupColor = (typeof GROUP_COLORS)[number]

export interface GroupCounts {
  total: number
  byType: Record<string, number>
}

export interface EntityGroup {
  id: number
  campaign_id: number
  name: string
  description: string | null
  color: string | null
  icon: string | null
  created_at: string
  updated_at: string
  _counts?: GroupCounts
}

export interface GroupMember {
  entity_id: number
  entity_name: string
  entity_type: string
  entity_type_id: number
  entity_image_url: string | null
  added_at: string
}

// For export/import
export interface ExportEntityGroup {
  _exportId: string
  name: string
  description?: string
  color?: string
  icon?: string
}

export interface ExportGroupMember {
  group: string
  entity: string
}

// Utility: Get contrast color (black/white) for text on colored background
export function getContrastColor(bgColor: string | null): string {
  if (!bgColor) return 'grey'
  const hex = bgColor.replace('#', '')
  if (hex.length !== 6) return 'white'
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? 'black' : 'white'
}
