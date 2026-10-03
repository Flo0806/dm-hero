// Sharing with players: what kinds exist and what travels (encrypted) to them

/** Kinds of things the DM can share. Grows step by step (npc first). */
export const SHARE_TYPES = ['npc'] as const
export type ShareType = (typeof SHARE_TYPES)[number]

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
