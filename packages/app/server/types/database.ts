/**
 * Common database row types used across the API
 */

export interface CountRow {
  count: number
}

export interface IdRow {
  id: number
}

export interface NameRow {
  name: string
}

export interface SettingRow {
  key: string
  value: string
  created_at: string
  updated_at: string
}

export interface ClassRow {
  id: number
  name: string
  name_de: string | null
  name_en: string | null
  is_standard: number
  created_at: string
  deleted_at: string | null
}

export interface RaceRow {
  id: number
  name: string
  name_de: string | null
  name_en: string | null
  is_standard: number
  created_at: string
  deleted_at: string | null
}

export interface EntityTypeRow {
  id: number
  name: string
}

export interface CampaignRow {
  id: number
  name: string
  description: string | null
  created_at: string
  deleted_at: string | null
}

export interface EntityRow {
  id: number
  name: string
  description: string | null
  type_id: number
  campaign_id: number
  image_url: string | null
  parent_entity_id: number | null
  metadata: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface EntityImageRow {
  id: number
  entity_id: number
  image_url: string
  is_primary: number
  display_order: number
  caption: string | null
  created_at: string
}

export interface EntityDocumentRow {
  id: number
  entity_id: number
  title: string
  content: string | null
  file_path: string | null
  file_type: string
  display_order: number
  created_at: string
  updated_at: string
}

export interface ItemRarityRow {
  id: number
  name: string
  sort_order: number
  deleted_at: string | null
}

export interface ItemTypeRow {
  id: number
  name: string
  sort_order: number
  deleted_at: string | null
}
