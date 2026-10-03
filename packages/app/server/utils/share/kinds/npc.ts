import type Database from 'better-sqlite3'
import type { NpcMetadata } from '~~/types/npc'
import type { BuiltField, LocalizedText } from '~~/types/share'
import { translateAll } from '../i18n'
import type { ShareKind } from '../registry'
import { resolveEntityLinks } from '../text'
import { list, localize, sharedFieldsOf, type KnownKeys, type SharedKeys } from './helpers'

// Every NPC field MUST be listed here as 'share' or 'private'. A new field in
// NpcMetadata breaks the build until someone decides - nothing leaks by accident.
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

type NpcShareField = SharedKeys<typeof NPC_FIELD_POLICY>
const NPC_SHARE_FIELDS = sharedFieldsOf(NPC_FIELD_POLICY)

function fieldValue(db: Database.Database, field: Exclude<NpcShareField, 'image'>, npc: NpcRow, meta: NpcMetadata): LocalizedText | null {
  switch (field) {
    case 'description': return npc.description?.trim() ? resolveEntityLinks(db, npc.description) || null : null
    case 'race': return localize('referenceData.raceNames', list(meta.race))
    case 'class': return localize('referenceData.classNames', list(meta.class))
    case 'type': return localize('npcs.types', list(meta.type))
    case 'status': return localize('npcs.statuses', list(meta.status))
    case 'gender': return localize('npcs.genders', list(meta.gender))
    case 'age': return meta.age != null ? String(meta.age) : null
    case 'location': {
      const location = npc.location_id
        ? db.prepare('SELECT name FROM entities WHERE id = ? AND deleted_at IS NULL').get(npc.location_id) as { name: string } | undefined
        : undefined
      return location?.name ?? (typeof meta.location === 'string' && meta.location.trim() ? meta.location : null)
    }
    case 'faction': {
      // Faction relations in both directions (see CLAUDE.md: bidirectional relations)
      const names = (db.prepare(`
        SELECT DISTINCT f.name FROM entity_relations r
        JOIN entities f ON f.id = CASE WHEN r.from_entity_id = ? THEN r.to_entity_id ELSE r.from_entity_id END
        JOIN entity_types t ON t.id = f.type_id AND t.name = 'Faction'
        WHERE (r.from_entity_id = ? OR r.to_entity_id = ?) AND f.deleted_at IS NULL
      `).all(npc.id, npc.id, npc.id) as Array<{ name: string }>).map(f => f.name)
      return names.length ? names.join(', ') : null
    }
  }
}

interface NpcRow {
  id: number
  name: string
  description: string | null
  metadata: string | null
  location_id: number | null
  image_url: string | null
}

export const npcShareKind: ShareKind = {
  typeLabel: 'npcs.title',
  fields: NPC_SHARE_FIELDS,
  build(db, entityId, fields) {
    const npc = db.prepare(`
      SELECT e.id, e.name, e.description, e.metadata, e.location_id, e.image_url FROM entities e
      JOIN entity_types t ON t.id = e.type_id AND t.name = 'NPC'
      WHERE e.id = ? AND e.deleted_at IS NULL
    `).get(entityId) as NpcRow | undefined
    if (!npc) return null

    const meta = JSON.parse(npc.metadata || '{}') as NpcMetadata
    const shared: BuiltField[] = []
    for (const field of NPC_SHARE_FIELDS) {
      if (!fields.includes(field)) continue
      // Image: the sync resizes, encrypts and uploads it
      if (field === 'image') {
        if (npc.image_url) shared.push({ key: field, format: 'image', label: translateAll('npcs.image') ?? 'Image', source: npc.image_url })
        continue
      }
      const value = fieldValue(db, field, npc, meta)
      if (value) {
        shared.push({ key: field, format: field === 'description' ? 'markdown' : 'text', label: translateAll(`npcs.${field}`) ?? field, value })
      }
    }
    return { title: npc.name, fields: shared }
  },
}
