// Field types supported in stat blocks
export const STAT_FIELD_TYPES = ['string', 'number', 'resource', 'boolean'] as const
export type StatFieldType = (typeof STAT_FIELD_TYPES)[number]

// Group type suggestions (for i18n label display)
export const STAT_GROUP_TYPES = ['attributes', 'resources', 'combat', 'saves', 'skills', 'custom'] as const
export type StatGroupType = (typeof STAT_GROUP_TYPES)[number]

// Known RPG system keys for preset templates
export const STAT_SYSTEM_KEYS = ['dnd5e', 'pathfinder2e', 'dsa5', 'splittermond', 'blank'] as const
export type StatSystemKey = (typeof STAT_SYSTEM_KEYS)[number]

// --- DB Row types ---

export interface StatTemplateDbRow {
  id: number
  name: string
  system_key: string | null
  description: string | null
  sort_order: number
  is_imported: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface StatTemplateGroupDbRow {
  id: number
  template_id: number
  name: string
  group_type: string
  sort_order: number
  created_at: string
}

export interface StatTemplateFieldDbRow {
  id: number
  group_id: number
  name: string
  label: string
  field_type: string
  has_modifier: number
  sort_order: number
  created_at: string
}

// --- Frontend types ---

export interface StatTemplateField {
  id: number
  group_id: number
  name: string
  label: string
  field_type: StatFieldType
  has_modifier: boolean
  sort_order: number
}

export interface StatTemplateGroup {
  id: number
  template_id: number
  name: string
  group_type: StatGroupType
  sort_order: number
  fields: StatTemplateField[]
}

export interface StatTemplate {
  id: number
  name: string
  system_key: StatSystemKey | null
  description: string | null
  sort_order: number
  is_imported: boolean
  created_at: string
  updated_at: string
  groups: StatTemplateGroup[]
}

// --- API Payloads ---

export interface CreateStatTemplatePayload {
  name: string
  system_key?: string | null
  description?: string | null
  fromPreset?: StatSystemKey
  groups?: SaveStatTemplatePayload['groups']
}

export interface UpdateStatTemplatePayload {
  name?: string
  description?: string | null
}

export interface SaveStatTemplatePayload {
  name?: string
  description?: string | null
  groups: Array<{
    name: string
    group_type: string
    fields: Array<{
      name: string
      label: string
      field_type: StatFieldType
      has_modifier?: boolean
    }>
  }>
}

export interface DuplicateStatTemplatePayload {
  name?: string
}

// --- Entity stat values (linking entity to template) ---

export interface StatResourceValue {
  current: number
  max: number
}

export interface StatNumberWithModifier {
  value: number
  modifier: number
}

// Keys are field names, values depend on field_type
export type StatValues = Record<string, string | number | boolean | StatResourceValue | StatNumberWithModifier | null>

export interface EntityStatsDbRow {
  id: number
  entity_id: number
  template_id: number
  values_json: string
  created_at: string
  updated_at: string
}

export interface EntityStats {
  id: number
  entity_id: number
  template_id: number
  values: StatValues
  created_at: string
  updated_at: string
}

export interface SaveEntityStatsPayload {
  template_id: number
  values: StatValues
}

// --- Document type constants ---

export const DOCUMENT_TYPES = ['character_sheet'] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

// --- Preset definition (used by preset files, not DB) ---

export interface StatPresetField {
  name: string
  label: string // i18n key
  field_type: StatFieldType
  has_modifier?: boolean
}

export interface StatPresetGroup {
  name: string // i18n key
  group_type: StatGroupType
  fields: StatPresetField[]
}

export interface StatPreset {
  system_key: StatSystemKey
  name: string // i18n key
  description: string // i18n key
  groups: StatPresetGroup[]
}
