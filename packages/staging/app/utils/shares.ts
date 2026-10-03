// Shared content as it arrives (decrypted) from DM Hero.
// Mirrors packages/app/types/share.ts - this is the protocol between both apps.

export type LocalizedText = Partial<Record<string, string>> | string

/** The player app renders by format only - it knows nothing about NPCs, items ... */
export type SharedFieldFormat = 'text' | 'markdown'

export interface SharedField {
  key: string
  format: SharedFieldFormat
  label: LocalizedText
  value: LocalizedText
}

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

/** Text in the player's language - English, then anything, as fallback */
export function pickText(text: LocalizedText, locale: string): string {
  if (typeof text === 'string') return text
  return text[locale] ?? text.en ?? Object.values(text)[0] ?? ''
}
