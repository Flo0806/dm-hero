import type { LocationMetadata } from '~~/types/location'
import { defineEntityShareKind } from './define'
import { list, localize, type KnownKeys } from './helpers'

// Every location field MUST be listed as 'share' or 'private' (see npc.ts)
const LOCATION_FIELD_POLICY = {
  image: 'share',
  description: 'share',
  type: 'share',
  region: 'share',
  // "Lies in: Silbermond" - sharing a place reveals where it is anyway
  parent: 'share',
  notes: 'private',
} as const satisfies Record<KnownKeys<LocationMetadata> | 'description' | 'image' | 'parent', 'share' | 'private'>

export const locationShareKind = defineEntityShareKind<typeof LOCATION_FIELD_POLICY, LocationMetadata>({
  type: 'location',
  policy: LOCATION_FIELD_POLICY,
  value(field, { db, row, meta }) {
    switch (field) {
      case 'type': return localize('locations.types', list(meta.type))
      case 'region': return typeof meta.region === 'string' && meta.region.trim() ? meta.region.trim() : null
      case 'parent': {
        const parent = row.parent_entity_id
          ? db.prepare('SELECT name FROM entities WHERE id = ? AND deleted_at IS NULL').get(row.parent_entity_id) as { name: string } | undefined
          : undefined
        return parent?.name ?? null
      }
    }
  },
})
