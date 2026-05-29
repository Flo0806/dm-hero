import { getDb } from '~~/server/utils/db'
import { convertMetadataToKeys, getLocaleFromEvent } from '~~/server/utils/i18n-lookup'
import { normaliseTagName, isValidTagName, DEFAULT_TAG_COLOR } from '~~/types/tag'
import { entityTypeToFolderType } from '~~/server/utils/folders'

/**
 * AI bulk-import: create entities + relations in one validated call.
 *
 * POST /api/import/bulk?dryRun=true  → validate + preview, write nothing
 * POST /api/import/bulk              → create, return a summary
 *
 * Payload (see GET /api/import/contract for the full contract):
 *   {
 *     campaignId,
 *     entities: [{ ref, type, name, description?, metadata?, tags?, folder? }],
 *     relations: [{ from, to, type }]   // from/to reference entity refs
 *   }
 *
 * Refs are local to the payload ("npc:1") and resolved to real ids on commit.
 * Validation is strict and happens BEFORE any write so a bad payload never
 * half-imports.
 */

const ENTITY_TYPES = ['NPC', 'Location', 'Item', 'Faction', 'Lore'] as const
type ImportEntityType = typeof ENTITY_TYPES[number]
const META_CONVERT: Partial<Record<ImportEntityType, 'npc' | 'item'>> = { NPC: 'npc', Item: 'item' }

interface InEntity {
  ref?: string
  type?: string
  name?: string
  description?: string
  metadata?: Record<string, unknown>
  tags?: string[]
  folder?: string
}
interface InRelation { from?: string, to?: string, type?: string }
interface InBody { campaignId?: number, entities?: InEntity[], relations?: InRelation[] }

export default defineEventHandler(async (event) => {
  const db = getDb()
  const dryRun = (() => {
    const q = getQuery(event).dryRun
    return q === 'true' || q === '1' || q === true
  })()
  const body = await readBody<InBody>(event)
  const locale = getLocaleFromEvent(event)

  const errors: string[] = []
  const campaignId = Number(body?.campaignId)
  if (!Number.isFinite(campaignId) || campaignId <= 0) errors.push('campaignId is required')
  else {
    const c = db.prepare('SELECT id FROM campaigns WHERE id = ? AND deleted_at IS NULL').get(campaignId)
    if (!c) errors.push(`campaign ${campaignId} not found`)
  }

  const entities = Array.isArray(body?.entities) ? body!.entities : []
  const relations = Array.isArray(body?.relations) ? body!.relations : []
  if (entities.length === 0) errors.push('entities must be a non-empty array')

  // --- validate entities + collect refs ---
  const refs = new Set<string>()
  for (const [i, e] of entities.entries()) {
    const at = `entities[${i}]`
    if (!e.ref || typeof e.ref !== 'string') {
      errors.push(`${at}: ref is required`)
      continue
    }
    if (refs.has(e.ref)) errors.push(`${at}: duplicate ref "${e.ref}"`)
    refs.add(e.ref)
    if (!e.type || !(ENTITY_TYPES as readonly string[]).includes(e.type)) {
      errors.push(`${at}: type must be one of ${ENTITY_TYPES.join(', ')}`)
    }
    if (!e.name || !e.name.trim()) errors.push(`${at}: name is required`)
    if (e.tags) {
      for (const t of e.tags) {
        if (!isValidTagName(normaliseTagName(t))) errors.push(`${at}: invalid tag "${t}" (lowercase a-z + hyphens)`)
      }
    }
  }

  // --- validate relations reference known refs ---
  for (const [i, r] of relations.entries()) {
    const at = `relations[${i}]`
    if (!r.type || !String(r.type).trim()) errors.push(`${at}: type is required`)
    if (!r.from || !refs.has(r.from)) errors.push(`${at}: from "${r.from}" is not a known entity ref`)
    if (!r.to || !refs.has(r.to)) errors.push(`${at}: to "${r.to}" is not a known entity ref`)
    if (r.from && r.from === r.to) errors.push(`${at}: from and to are the same`)
  }

  if (errors.length > 0) {
    throw createError({ statusCode: 400, data: { errors }, message: `Validation failed: ${errors.length} error(s)` })
  }

  // --- resolve metadata to keys (per type) up-front so dry-run shows the real
  // stored values and commit reuses them ---
  const resolved = await Promise.all(entities.map(async (e) => {
    const conv = META_CONVERT[e.type as ImportEntityType]
    const metadata = conv ? await convertMetadataToKeys(e.metadata, conv, locale) : (e.metadata ?? undefined)
    return { ...e, _metadata: metadata }
  }))

  // Count per type for the summary/preview.
  const perType: Record<string, number> = {}
  for (const e of entities) perType[e.type!] = (perType[e.type!] ?? 0) + 1

  if (dryRun) {
    return {
      dryRun: true,
      wouldCreate: {
        entities: entities.length,
        byType: perType,
        relations: relations.length,
        tags: [...new Set(entities.flatMap(e => (e.tags ?? []).map(normaliseTagName)))],
        folders: [...new Set(entities.filter(e => e.folder).map(e => `${e.type}:${e.folder}`))],
      },
      preview: resolved.map(e => ({ ref: e.ref, type: e.type, name: e.name, metadata: e._metadata })),
    }
  }

  // ==========================================================================
  // COMMIT — single transaction
  // ==========================================================================
  const typeRow = (name: string) => db.prepare('SELECT id FROM entity_types WHERE name = ?').get(name) as { id: number } | undefined
  const insertEntity = db.prepare('INSERT INTO entities (type_id, campaign_id, name, description, metadata, folder_id) VALUES (?, ?, ?, ?, ?, ?)')
  const findFolder = db.prepare('SELECT id FROM entity_folders WHERE campaign_id = ? AND entity_type = ? AND name = ? AND deleted_at IS NULL')
  const insertFolder = db.prepare('INSERT INTO entity_folders (campaign_id, entity_type, name) VALUES (?, ?, ?)')
  const findTag = db.prepare('SELECT id, deleted_at FROM tags WHERE name = ?')
  const reviveTag = db.prepare('UPDATE tags SET deleted_at = NULL WHERE id = ?')
  const insertTag = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)')
  const attachTag = db.prepare('INSERT OR IGNORE INTO entity_tags (entity_id, tag_id) VALUES (?, ?)')
  const insertRelation = db.prepare('INSERT OR IGNORE INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)')

  const refToId = new Map<string, number>()
  const folderCache = new Map<string, number>() // `${type}:${name}` → id
  const tagCache = new Map<string, number>()

  db.exec('BEGIN')
  try {
    for (const e of resolved) {
      const t = typeRow(e.type!)
      if (!t) throw createError({ statusCode: 500, message: `entity type ${e.type} not found` })

      // Folder (reuse existing per campaign+type, else create)
      let folderId: number | null = null
      if (e.folder) {
        const folderType = entityTypeToFolderType(e.type!)
        if (folderType) {
          const key = `${folderType}:${e.folder}`
          if (folderCache.has(key)) folderId = folderCache.get(key)!
          else {
            const existing = findFolder.get(campaignId, folderType, e.folder) as { id: number } | undefined
            folderId = existing
              ? existing.id
              : Number(insertFolder.run(campaignId, folderType, e.folder).lastInsertRowid)
            folderCache.set(key, folderId)
          }
        }
      }

      const res = insertEntity.run(
        t.id,
        campaignId,
        e.name!.trim(),
        e.description?.trim() || null,
        e._metadata ? JSON.stringify(e._metadata) : null,
        folderId,
      )
      refToId.set(e.ref!, Number(res.lastInsertRowid))

      // Tags (reuse/revive/create, then attach)
      for (const raw of e.tags ?? []) {
        const name = normaliseTagName(raw)
        let tagId = tagCache.get(name)
        if (!tagId) {
          const found = findTag.get(name) as { id: number, deleted_at: string | null } | undefined
          if (found) {
            if (found.deleted_at) reviveTag.run(found.id)
            tagId = found.id
          }
          else {
            tagId = Number(insertTag.run(name, DEFAULT_TAG_COLOR).lastInsertRowid)
          }
          tagCache.set(name, tagId)
        }
        attachTag.run(Number(res.lastInsertRowid), tagId)
      }
    }

    // Relations (bidirectional store: one row, queried both directions elsewhere)
    let relationsCreated = 0
    for (const r of relations) {
      const fromId = refToId.get(r.from!)
      const toId = refToId.get(r.to!)
      if (fromId && toId) {
        insertRelation.run(fromId, toId, String(r.type))
        relationsCreated++
      }
    }

    db.exec('COMMIT')

    return {
      dryRun: false,
      created: { entities: refToId.size, byType: perType, relations: relationsCreated },
      refToId: Object.fromEntries(refToId),
    }
  }
  catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
})
