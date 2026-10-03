import type Database from 'better-sqlite3'
import type { ItemMetadata } from '~~/types/item'
import type { BuiltField, LocalizedText } from '~~/types/share'
import { translateAll } from '../i18n'
import type { ShareKind } from '../registry'
import { resolveEntityLinks } from '../text'
import { list, localize, sharedFieldsOf, type KnownKeys, type SharedKeys } from './helpers'

// Every item field MUST be listed as 'share' or 'private' - a new field
// breaks the typecheck until someone decides (see npc.ts)
const ITEM_FIELD_POLICY = {
  image: 'share',
  description: 'share',
  type: 'share',
  rarity: 'share',
  // Value can be held back until the players had it appraised - it's a tick per item
  value: 'share',
  currency_id: 'share', // shown together with value
  weight: 'share',
  notes: 'private',
  // In the type but not editable in DM Hero (legacy / import only) - not offered
  attunement: 'private',
  damage: 'private',
  armor_class: 'private',
  charges: 'private',
  properties: 'private',
} as const satisfies Record<KnownKeys<ItemMetadata> | 'description' | 'image', 'share' | 'private'>

type ItemShareField = Exclude<SharedKeys<typeof ITEM_FIELD_POLICY>, 'currency_id'>
// currency_id is no field of its own for the DM - it belongs to value
const ITEM_SHARE_FIELDS = sharedFieldsOf(ITEM_FIELD_POLICY).filter((f): f is ItemShareField => f !== 'currency_id')

interface ItemRow {
  id: number
  name: string
  description: string | null
  metadata: string | null
  image_url: string | null
}

function fieldValue(db: Database.Database, field: Exclude<ItemShareField, 'image'>, item: ItemRow, meta: ItemMetadata): LocalizedText | null {
  switch (field) {
    case 'description': return item.description?.trim() ? resolveEntityLinks(db, item.description) || null : null
    case 'type': return localize('items.types', list(meta.type))
    case 'rarity': return localize('items.rarities', list(meta.rarity))
    case 'value': {
      if (meta.value == null) return null
      const currency = meta.currency_id
        ? db.prepare('SELECT symbol, code FROM currencies WHERE id = ?').get(meta.currency_id) as { symbol: string | null, code: string } | undefined
        : undefined
      return [meta.value, currency?.symbol || currency?.code].filter(v => v != null && v !== '').join(' ')
    }
    case 'weight': return meta.weight != null ? String(meta.weight) : null
  }
}

export const itemShareKind: ShareKind = {
  typeLabel: 'items.title',
  fields: ITEM_SHARE_FIELDS,
  build(db, entityId, fields) {
    const item = db.prepare(`
      SELECT e.id, e.name, e.description, e.metadata, e.image_url FROM entities e
      JOIN entity_types t ON t.id = e.type_id AND t.name = 'Item'
      WHERE e.id = ? AND e.deleted_at IS NULL
    `).get(entityId) as ItemRow | undefined
    if (!item) return null

    const meta = JSON.parse(item.metadata || '{}') as ItemMetadata
    const shared: BuiltField[] = []
    for (const field of ITEM_SHARE_FIELDS) {
      if (!fields.includes(field)) continue
      if (field === 'image') {
        if (item.image_url) shared.push({ key: field, format: 'image', label: translateAll('items.image') ?? 'Image', source: item.image_url })
        continue
      }
      const value = fieldValue(db, field, item, meta)
      if (value) {
        shared.push({ key: field, format: field === 'description' ? 'markdown' : 'text', label: translateAll(`items.${field}`) ?? field, value })
      }
    }
    return { title: item.name, fields: shared }
  },
}
