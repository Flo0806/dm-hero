// Shared content as it arrives (decrypted) from DM Hero.
// Mirrors packages/app/types/share.ts - this is the protocol between both apps.

export type LocalizedText = Partial<Record<string, string>> | string

/** An encrypted file on the relay - key + iv come inside the DM-signed envelope */
export interface SharedFileRef {
  fileId: string
  key: string
  iv: string
  mime: string
}

/** The player app renders by format only - it knows nothing about NPCs, items ... */
export type SharedField
  = | { key: string, format: 'text' | 'markdown', label: LocalizedText, value: LocalizedText }
    | { key: string, format: 'image', label: LocalizedText, image: { thumb: SharedFileRef, full: SharedFileRef } }

export type ImageField = Extract<SharedField, { format: 'image' }>

export const imageOf = (share: ShareContent) => share.fields.find((f): f is ImageField => f.format === 'image')

export interface ShareContent {
  shareId: string
  type: string
  /** Category name in all languages, sent by DM Hero */
  typeLabel: LocalizedText
  title: string
  fields: SharedField[]
  sharedAt: string
  updatedAt: string
}

/** A live moment worth celebrating: an alias got its real name, new info, or something new shared */
export interface Reveal {
  shareId: string
  kind: 'name' | 'info' | 'new'
  title: string
  /** Previous name (kind 'name') */
  previousTitle?: string
  /** Labels of fields that just appeared (kind 'info') */
  newFields?: LocalizedText[]
}

/** Text in the player's language - English, then anything, as fallback */
export function pickText(text: LocalizedText, locale: string): string {
  if (typeof text === 'string') return text
  return text[locale] ?? text.en ?? Object.values(text)[0] ?? ''
}
