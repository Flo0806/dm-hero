import type Database from 'better-sqlite3'
import type { LocationMetadata } from '~~/types/location'
import type { BuiltField, LocalizedText } from '~~/types/share'
import { translateAll } from '../i18n'
import type { ShareKind } from '../registry'
import { resolveEntityLinks } from '../text'
import { list, localize, sharedFieldsOf, type KnownKeys, type SharedKeys } from './helpers'

// Every location field MUST be listed as 'share' or 'private' - a new field
// breaks the typecheck until someone decides (see npc.ts)
const LOCATION_FIELD_POLICY = {
  image: 'share',
  description: 'share',
  type: 'share',
  region: 'share',
  // "Lies in: Silbermond" - sharing a place reveals where it is anyway
  parent: 'share',
  notes: 'private',
} as const satisfies Record<KnownKeys<LocationMetadata> | 'description' | 'image' | 'parent', 'share' | 'private'>

type LocationShareField = SharedKeys<typeof LOCATION_FIELD_POLICY>
const LOCATION_SHARE_FIELDS = sharedFieldsOf(LOCATION_FIELD_POLICY)

interface LocationRow {
  id: number
  name: string
  description: string | null
  metadata: string | null
  image_url: string | null
  parent_entity_id: number | null
}

function fieldValue(db: Database.Database, field: Exclude<LocationShareField, 'image'>, location: LocationRow, meta: LocationMetadata): LocalizedText | null {
  switch (field) {
    case 'description': return location.description?.trim() ? resolveEntityLinks(db, location.description) || null : null
    case 'type': return localize('locations.types', list(meta.type))
    case 'region': return typeof meta.region === 'string' && meta.region.trim() ? meta.region.trim() : null
    case 'parent': {
      const parent = location.parent_entity_id
        ? db.prepare('SELECT name FROM entities WHERE id = ? AND deleted_at IS NULL').get(location.parent_entity_id) as { name: string } | undefined
        : undefined
      return parent?.name ?? null
    }
  }
}

export const locationShareKind: ShareKind = {
  typeLabel: 'locations.title',
  fields: LOCATION_SHARE_FIELDS,
  build(db, entityId, fields) {
    const location = db.prepare(`
      SELECT e.id, e.name, e.description, e.metadata, e.image_url, e.parent_entity_id FROM entities e
      JOIN entity_types t ON t.id = e.type_id AND t.name = 'Location'
      WHERE e.id = ? AND e.deleted_at IS NULL
    `).get(entityId) as LocationRow | undefined
    if (!location) return null

    const meta = JSON.parse(location.metadata || '{}') as LocationMetadata
    const shared: BuiltField[] = []
    for (const field of LOCATION_SHARE_FIELDS) {
      if (!fields.includes(field)) continue
      if (field === 'image') {
        if (location.image_url) shared.push({ key: field, format: 'image', label: translateAll('locations.image') ?? 'Image', source: location.image_url })
        continue
      }
      const value = fieldValue(db, field, location, meta)
      if (value) {
        shared.push({ key: field, format: field === 'description' ? 'markdown' : 'text', label: translateAll(`locations.${field}`) ?? field, value })
      }
    }
    return { title: location.name, fields: shared }
  },
}
