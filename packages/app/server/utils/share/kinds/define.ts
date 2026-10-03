import type Database from 'better-sqlite3'
import { SHARE_TYPE_CONFIG, type BuiltField, type LocalizedText, type ShareType } from '~~/types/share'
import { translateAll } from '../i18n'
import type { ShareKind } from '../registry'
import { resolveEntityLinks } from '../text'
import { sharedFieldsOf, type SharedKeys } from './helpers'

// Everything share kinds have in common: load the entity, image + description
// (with entity links resolved), labels in all languages. A kind only brings its
// field policy and the values of its own fields.

export interface EntityRow {
  id: number
  name: string
  description: string | null
  metadata: string | null
  image_url: string | null
  location_id: number | null
  parent_entity_id: number | null
}

type Policy = Record<string, 'share' | 'private'>

interface EntityShareKindConfig<P extends Policy, M, H extends SharedKeys<P> = never> {
  type: ShareType
  /** Field policy - each kind checks it against its metadata type (`satisfies`) */
  policy: P
  /** Shared, but not offered on their own (they belong to another field, e.g. currency to value) */
  hidden?: readonly H[]
  /** Field -> label key if they differ (labels live under <i18n>.<label>) */
  labels?: Partial<Record<string, string>>
  /** Values of the kind's own fields (image + description are handled here). Names of other entities via sharedEntityName (aliases!) */
  value: (field: Exclude<SharedKeys<P>, 'image' | 'description' | H>, ctx: { db: Database.Database, tableId: number, row: EntityRow, meta: M }) => LocalizedText | null
}

export function defineEntityShareKind<P extends Policy, M, H extends SharedKeys<P> = never>(config: EntityShareKindConfig<P, M, H>): ShareKind {
  const { entityType, i18n } = SHARE_TYPE_CONFIG[config.type]
  const fields = sharedFieldsOf(config.policy).filter(f => !(config.hidden as readonly string[] | undefined)?.includes(f as string)) as string[]
  const label = (field: string) => translateAll(`${i18n}.${config.labels?.[field] ?? field}`) ?? field

  return {
    typeLabel: `${i18n}.title`,
    fields,
    build(db, entityId, ticked, { tableId }) {
      const row = db.prepare(`
        SELECT e.id, e.name, e.description, e.metadata, e.image_url, e.location_id, e.parent_entity_id FROM entities e
        JOIN entity_types t ON t.id = e.type_id AND t.name = ?
        WHERE e.id = ? AND e.deleted_at IS NULL
      `).get(entityType, entityId) as EntityRow | undefined
      if (!row) return null

      const meta = JSON.parse(row.metadata || '{}') as M
      const shared: BuiltField[] = []
      for (const field of fields) {
        if (!ticked.includes(field)) continue
        if (field === 'image') {
          // The sync resizes, encrypts and uploads it
          if (row.image_url) shared.push({ key: field, format: 'image', label: label(field), source: row.image_url })
          continue
        }
        if (field === 'description') {
          const text = row.description?.trim() ? resolveEntityLinks(db, tableId, row.description) : ''
          if (text) shared.push({ key: field, format: 'markdown', label: label(field), value: text })
          continue
        }
        const value = config.value(field as Parameters<typeof config.value>[0], { db, tableId, row, meta })
        if (value) shared.push({ key: field, format: 'text', label: label(field), value })
      }
      return { title: row.name, fields: shared }
    },
  }
}
