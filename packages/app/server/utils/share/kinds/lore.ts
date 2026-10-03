import type { LoreMetadata } from '~~/types/lore'
import { defineEntityShareKind } from './define'
import { list, localize, type KnownKeys } from './helpers'

// Every lore field MUST be listed as 'share' or 'private' (see npc.ts).
// Lore has no private field: secrets can only be in the description, shared by tick.
const LORE_FIELD_POLICY = {
  image: 'share',
  description: 'share',
  type: 'share',
  // Shown as entered - it may be an in-game date
  date: 'share',
} as const satisfies Record<KnownKeys<LoreMetadata> | 'description' | 'image', 'share' | 'private'>

export const loreShareKind = defineEntityShareKind<typeof LORE_FIELD_POLICY, LoreMetadata>({
  type: 'lore',
  policy: LORE_FIELD_POLICY,
  value(field, { meta }) {
    switch (field) {
      case 'type': return localize('lore.types', list(meta.type))
      case 'date': return typeof meta.date === 'string' && meta.date.trim() ? meta.date.trim() : null
    }
  },
})
