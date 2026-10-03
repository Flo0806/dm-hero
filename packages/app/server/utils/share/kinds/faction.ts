import type { FactionMetadata } from '~~/types/faction'
import { defineEntityShareKind } from './define'
import { list, localize, type KnownKeys } from './helpers'

// Every faction field MUST be listed as 'share' or 'private' (see npc.ts).
// Members are relations - intentionally not shared.
const FACTION_FIELD_POLICY = {
  image: 'share',
  description: 'share',
  type: 'share',
  alignment: 'share',
  headquarters: 'share',
  location: 'share',
  // Often THE secret of a faction - a tick the DM sets once the group found out
  goals: 'share',
  notes: 'private',
} as const satisfies Record<KnownKeys<FactionMetadata> | 'description' | 'image' | 'location', 'share' | 'private'>

const trimmed = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)

export const factionShareKind = defineEntityShareKind<typeof FACTION_FIELD_POLICY, FactionMetadata>({
  type: 'faction',
  policy: FACTION_FIELD_POLICY,
  labels: { location: 'currentLocation' },
  value(field, { db, row, meta }) {
    switch (field) {
      case 'type': return localize('factions.types', list(meta.type))
      case 'alignment': return localize('factions.alignments', list(meta.alignment))
      case 'headquarters': return trimmed(meta.headquarters)
      case 'goals': return trimmed(meta.goals)
      case 'location': {
        const location = row.location_id
          ? db.prepare('SELECT name FROM entities WHERE id = ? AND deleted_at IS NULL').get(row.location_id) as { name: string } | undefined
          : undefined
        return location?.name ?? null
      }
    }
  },
})
