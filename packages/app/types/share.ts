// Sharing with players: what kinds exist and what travels (encrypted) to them

/** Kinds of things the DM can share. Grows step by step (npc first). */
export const SHARE_TYPES = ['npc'] as const
export type ShareType = (typeof SHARE_TYPES)[number]

/** Text in every app language (players pick theirs), or plain text written by the DM */
export type LocalizedText = Partial<Record<'de' | 'en' | 'es' | 'fr' | 'it' | 'zh-CN', string>> | string

/** One shared field as players see it - label and value in all languages, ready to read */
export interface SharedField {
  key: string
  label: LocalizedText
  value: LocalizedText
}

/** Decrypted content of a share on the player side */
export interface ShareContent {
  /** Must match the relay's share id - the relay can't swap shares */
  shareId: string
  type: ShareType
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
  title: string | null
  created_at: string
  updated_at: string
}
