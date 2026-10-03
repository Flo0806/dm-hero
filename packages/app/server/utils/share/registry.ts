import type Database from 'better-sqlite3'
import type { BuiltField, ShareType } from '~~/types/share'
import { factionShareKind } from './kinds/faction'
import { itemShareKind } from './kinds/item'
import { locationShareKind } from './kinds/location'
import { loreShareKind } from './kinds/lore'
import { npcShareKind } from './kinds/npc'

// One entry per share type: which fields the DM can tick and how the content
// players see is built. Fields that aren't listed here can never be shared.

/** The game a share is built for - e.g. to show aliases instead of real names */
export interface ShareContext {
  tableId: number
}

export interface ShareKind {
  /** i18n key of the category name players see ("npcs.title" -> "NPCs") */
  typeLabel: string
  /** Fields the DM can share, in display order */
  fields: readonly string[]
  /** What players see right now - null if the entity is gone (share gets withdrawn) */
  build: (db: Database.Database, entityId: number, fields: string[], ctx: ShareContext) => { title: string, fields: BuiltField[] } | null
}

export const SHARE_KINDS: Partial<Record<ShareType, ShareKind>> = {
  npc: npcShareKind,
  location: locationShareKind,
  item: itemShareKind,
  lore: loreShareKind,
  faction: factionShareKind,
}

export function getShareKind(type: string): ShareKind {
  const kind = SHARE_KINDS[type as ShareType]
  if (!kind) throw createError({ statusCode: 400, message: `Cannot share type "${type}"` })
  return kind
}
