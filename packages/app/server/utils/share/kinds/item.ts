import type { ItemMetadata } from '~~/types/item'
import { defineEntityShareKind } from './define'
import { list, localize, type KnownKeys } from './helpers'

// Every item field MUST be listed as 'share' or 'private' (see npc.ts)
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

export const itemShareKind = defineEntityShareKind<typeof ITEM_FIELD_POLICY, ItemMetadata, 'currency_id'>({
  type: 'item',
  policy: ITEM_FIELD_POLICY,
  hidden: ['currency_id'],
  value(field, { db, meta }) {
    switch (field) {
      case 'type': return localize('items.types', list(meta.type))
      case 'rarity': return localize('items.rarities', list(meta.rarity))
      case 'weight': return meta.weight != null ? String(meta.weight) : null
      case 'value': {
        if (meta.value == null) return null
        const currency = meta.currency_id
          ? db.prepare('SELECT symbol, code FROM currencies WHERE id = ?').get(meta.currency_id) as { symbol: string | null, code: string } | undefined
          : undefined
        return [meta.value, currency?.symbol || currency?.code].filter(v => v != null && v !== '').join(' ')
      }
    }
  },
})
