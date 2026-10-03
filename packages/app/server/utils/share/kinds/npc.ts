import type { NpcMetadata } from '~~/types/npc'
import { defineEntityShareKind } from './define'
import { sharedEntityName, sharedName } from '../text'
import { list, localize, type KnownKeys } from './helpers'

// Every NPC field MUST be listed here as 'share' or 'private'. A new field in
// NpcMetadata breaks the typecheck until someone decides - nothing leaks by accident.
// (Notes and documents live in other tables and are never shared.)
const NPC_FIELD_POLICY = {
  image: 'share',
  description: 'share',
  race: 'share',
  class: 'share',
  type: 'share',
  status: 'share',
  age: 'share',
  gender: 'share',
  location: 'share',
  faction: 'share',
  relationship: 'private',
} as const satisfies Record<KnownKeys<NpcMetadata> | 'description' | 'image', 'share' | 'private'>

export const npcShareKind = defineEntityShareKind<typeof NPC_FIELD_POLICY, NpcMetadata>({
  type: 'npc',
  policy: NPC_FIELD_POLICY,
  value(field, { db, tableId, row, meta }) {
    switch (field) {
      case 'race': return localize('referenceData.raceNames', list(meta.race))
      case 'class': return localize('referenceData.classNames', list(meta.class))
      case 'type': return localize('npcs.types', list(meta.type))
      case 'status': return localize('npcs.statuses', list(meta.status))
      case 'gender': return localize('npcs.genders', list(meta.gender))
      case 'age': return meta.age != null ? String(meta.age) : null
      case 'location':
        return sharedEntityName(db, tableId, row.location_id) ?? (typeof meta.location === 'string' && meta.location.trim() ? meta.location : null)
      case 'faction': {
        // Faction relations in both directions (see CLAUDE.md: bidirectional relations)
        const names = (db.prepare(`
          SELECT DISTINCT f.id, f.name FROM entity_relations r
          JOIN entities f ON f.id = CASE WHEN r.from_entity_id = ? THEN r.to_entity_id ELSE r.from_entity_id END
          JOIN entity_types t ON t.id = f.type_id AND t.name = 'Faction'
          WHERE (r.from_entity_id = ? OR r.to_entity_id = ?) AND f.deleted_at IS NULL
        `).all(row.id, row.id, row.id) as Array<{ id: number, name: string }>).map(f => sharedName(db, tableId, f.id, f.name))
        return names.length ? names.join(', ') : null
      }
    }
  },
})
