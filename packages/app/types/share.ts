// Sharing with players: what kinds exist and what travels (encrypted) to them

/**
 * Every kind of thing the DM can share - the ONE place for a new kind besides its
 * server file (server/utils/share/kinds). entityType = entity_types.name,
 * i18n = namespace for labels (<i18n>.<field>) and the category name (<i18n>.title).
 */
export const SHARE_TYPE_CONFIG = {
  npc: { entityType: 'NPC', i18n: 'npcs', icon: 'mdi-account' },
  location: { entityType: 'Location', i18n: 'locations', icon: 'mdi-map-marker' },
  item: { entityType: 'Item', i18n: 'items', icon: 'mdi-sword' },
  lore: { entityType: 'Lore', i18n: 'lore', icon: 'mdi-book-open-variant' },
  faction: { entityType: 'Faction', i18n: 'factions', icon: 'mdi-shield-account' },
} as const

export type ShareType = keyof typeof SHARE_TYPE_CONFIG
export const SHARE_TYPES = Object.keys(SHARE_TYPE_CONFIG) as ShareType[]

/** Text in every app language (players pick theirs), or plain text written by the DM */
export type LocalizedText = Partial<Record<'de' | 'en' | 'es' | 'fr' | 'it' | 'zh-CN', string>> | string

/** An encrypted file on the relay - key + iv only travel inside the signed envelope */
export interface SharedFileRef {
  fileId: string
  key: string
  iv: string
  mime: string
}

/** How the player app renders a field - it knows formats, not share types */
export type SharedField
  = | { key: string, format: 'text' | 'markdown', label: LocalizedText, value: LocalizedText }
    | { key: string, format: 'image', label: LocalizedText, image: { thumb: SharedFileRef, full: SharedFileRef } }

/** What a share kind builds: images are still a local source, uploaded by the sync */
export type BuiltField
  = | Extract<SharedField, { format: 'text' | 'markdown' }>
    | { key: string, format: 'image', label: LocalizedText, source: string }

/** Decrypted content of a share on the player side */
export interface ShareContent {
  /** Must match the relay's share id - the relay can't swap shares */
  shareId: string
  type: ShareType
  /** Category name ("NPCs") in all languages - new kinds need no player app update */
  typeLabel: LocalizedText
  /** What players see as name - the DM may use an alias ("The mysterious man") */
  title: string
  fields: SharedField[]
  sharedAt: string
  updatedAt: string
}

/** A share as listed in DM Hero */
export interface GameTableShare {
  id: number
  entity_type: ShareType
  entity_id: number
  fields: string[]
  /** Real name (from the entity) */
  title: string | null
  /** Alias players see instead of the real name, null = real name */
  display_name: string | null
  created_at: string
  updated_at: string
}
