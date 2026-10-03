import type Database from 'better-sqlite3'
import type { SharedField, ShareType } from '~~/types/share'

// One entry per share type: which fields the DM can tick and how the content
// players see is built. Fields that aren't listed here can never be shared.

export interface ShareKind {
  /** Fields the DM can share, in display order */
  fields: readonly string[]
  /** What players see right now - null if the entity is gone (share gets withdrawn) */
  build: (db: Database.Database, entityId: number, fields: string[]) => { title: string, fields: SharedField[] } | null
}

export const SHARE_KINDS: Partial<Record<ShareType, ShareKind>> = {}

export function getShareKind(type: string): ShareKind {
  const kind = SHARE_KINDS[type as ShareType]
  if (!kind) throw createError({ statusCode: 400, message: `Cannot share type "${type}"` })
  return kind
}
