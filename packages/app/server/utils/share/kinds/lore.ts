import type Database from 'better-sqlite3'
import type { LoreMetadata } from '~~/types/lore'
import type { BuiltField, LocalizedText } from '~~/types/share'
import { translateAll } from '../i18n'
import type { ShareKind } from '../registry'
import { resolveEntityLinks } from '../text'
import { list, localize, sharedFieldsOf, type KnownKeys, type SharedKeys } from './helpers'

// Every lore field MUST be listed as 'share' or 'private' - a new field
// breaks the typecheck until someone decides (see npc.ts).
// Lore has no private field: secrets can only be in the description, shared by tick.
const LORE_FIELD_POLICY = {
  image: 'share',
  description: 'share',
  type: 'share',
  // Shown as entered - it may be an in-game date
  date: 'share',
} as const satisfies Record<KnownKeys<LoreMetadata> | 'description' | 'image', 'share' | 'private'>

type LoreShareField = SharedKeys<typeof LORE_FIELD_POLICY>
const LORE_SHARE_FIELDS = sharedFieldsOf(LORE_FIELD_POLICY)

interface LoreRow {
  id: number
  name: string
  description: string | null
  metadata: string | null
  image_url: string | null
}

function fieldValue(db: Database.Database, field: Exclude<LoreShareField, 'image'>, lore: LoreRow, meta: LoreMetadata): LocalizedText | null {
  switch (field) {
    case 'description': return lore.description?.trim() ? resolveEntityLinks(db, lore.description) || null : null
    case 'type': return localize('lore.types', list(meta.type))
    case 'date': return typeof meta.date === 'string' && meta.date.trim() ? meta.date.trim() : null
  }
}

export const loreShareKind: ShareKind = {
  typeLabel: 'lore.title',
  fields: LORE_SHARE_FIELDS,
  build(db, entityId, fields) {
    const lore = db.prepare(`
      SELECT e.id, e.name, e.description, e.metadata, e.image_url FROM entities e
      JOIN entity_types t ON t.id = e.type_id AND t.name = 'Lore'
      WHERE e.id = ? AND e.deleted_at IS NULL
    `).get(entityId) as LoreRow | undefined
    if (!lore) return null

    const meta = JSON.parse(lore.metadata || '{}') as LoreMetadata
    const shared: BuiltField[] = []
    for (const field of LORE_SHARE_FIELDS) {
      if (!fields.includes(field)) continue
      if (field === 'image') {
        if (lore.image_url) shared.push({ key: field, format: 'image', label: translateAll('lore.image') ?? 'Image', source: lore.image_url })
        continue
      }
      const value = fieldValue(db, field, lore, meta)
      if (value) shared.push({ key: field, format: field === 'description' ? 'markdown' : 'text', label: translateAll(`lore.${field}`) ?? field, value })
    }
    return { title: lore.name, fields: shared }
  },
}
