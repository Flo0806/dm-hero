import { getDb } from '~~/server/utils/db'
import { convertMetadataToKeys, getLocaleFromEvent } from '~~/server/utils/i18n-lookup'
import { normaliseTagName, isValidTagName, DEFAULT_TAG_COLOR } from '~~/types/tag'
import { entityTypeToFolderType } from '~~/server/utils/folders'
import { recordImport } from '~~/server/utils/importSignal'
import { mergeMetadata } from '~~/server/utils/importRefs'

/**
 * AI bulk-edit: update existing entities in one validated call.
 *
 * POST /api/import/update?dryRun=true  → validate + preview, write nothing
 * POST /api/import/update              → apply, return a summary
 *
 * Payload:
 *   {
 *     campaignId,
 *     updates: [{
 *       id,                       // existing entity id (get it via search_entities)
 *       name?,                    // set name
 *       description?,             // set description ("" clears it)
 *       metadata?,                // MERGED into existing metadata; a key set to
 *                                 //   null removes it (race/class converted to keys)
 *       folder?,                  // folder name (created if missing); "" / null removes
 *       tags?                     // REPLACES the entity's tag set (lowercase a-z + hyphens)
 *     }]
 *   }
 *
 * Only the provided fields change; everything else is left as-is. Validation is
 * strict and runs BEFORE any write, so a bad payload never half-applies.
 */

const META_CONVERT: Record<string, 'npc' | 'item'> = { NPC: 'npc', Item: 'item' }

interface InUpdate {
  id?: number
  name?: string
  description?: string
  metadata?: Record<string, unknown>
  folder?: string | null
  tags?: string[]
}
interface InBody { campaignId?: number, updates?: InUpdate[] }

interface EntityRow { id: number, type: string, name: string, description: string | null, metadata: string | null }

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
  else if (!db.prepare('SELECT id FROM campaigns WHERE id = ? AND deleted_at IS NULL').get(campaignId)) {
    errors.push(`campaign ${campaignId} not found`)
  }

  const updates = Array.isArray(body?.updates) ? body!.updates : []
  if (updates.length === 0) errors.push('updates must be a non-empty array')

  // Load every targeted entity once (scoped to the campaign) so we can validate
  // existence, know each type, and merge metadata.
  const ids = [...new Set(updates.map(u => Number(u.id)).filter(n => Number.isFinite(n) && n > 0))]
  const rowById = new Map<number, EntityRow>()
  if (ids.length > 0 && Number.isFinite(campaignId) && campaignId > 0) {
    const placeholders = ids.map(() => '?').join(',')
    const rows = db
      .prepare(`
        SELECT e.id, t.name AS type, e.name, e.description, e.metadata
        FROM entities e
        JOIN entity_types t ON t.id = e.type_id
        WHERE e.id IN (${placeholders}) AND e.campaign_id = ? AND e.deleted_at IS NULL
      `)
      .all(...ids, campaignId) as EntityRow[]
    for (const r of rows) rowById.set(r.id, r)
  }

  const seenIds = new Set<number>()
  for (const [i, u] of updates.entries()) {
    const at = `updates[${i}]`
    const id = Number(u.id)
    if (!Number.isFinite(id) || id <= 0) {
      errors.push(`${at}: id is required`)
      continue
    }
    // Reject duplicate ids: order-dependent patches + inflated counts otherwise.
    if (seenIds.has(id)) errors.push(`${at}: duplicate id ${id} (each entity may appear once)`)
    seenIds.add(id)
    if (!rowById.has(id)) errors.push(`${at}: entity ${id} not found in this campaign`)
    if (u.name !== undefined && !String(u.name).trim()) errors.push(`${at}: name cannot be empty`)
    if (u.tags) {
      for (const t of u.tags) {
        if (!isValidTagName(normaliseTagName(t))) errors.push(`${at}: invalid tag "${t}" (lowercase a-z + hyphens)`)
      }
    }
  }

  if (errors.length > 0) {
    throw createError({ statusCode: 400, data: { errors }, message: `Validation failed: ${errors.length} error(s)` })
  }

  // Resolve the merged result of each update up-front (metadata key conversion +
  // merge) so dry-run shows exactly what would be stored and commit reuses it.
  const resolved = await Promise.all(updates.map(async (u) => {
    const row = rowById.get(Number(u.id))!
    let metadata: Record<string, unknown> | undefined
    if (u.metadata !== undefined) {
      const existing = row.metadata ? JSON.parse(row.metadata) as Record<string, unknown> : {}
      const conv = META_CONVERT[row.type]
      const patch = conv ? await convertMetadataToKeys(u.metadata, conv, locale) : u.metadata
      metadata = mergeMetadata(existing, patch)
    }
    return { update: u, row, metadata }
  }))

  const perType: Record<string, number> = {}
  for (const r of resolved) perType[r.row.type] = (perType[r.row.type] ?? 0) + 1

  if (dryRun) {
    return {
      dryRun: true,
      wouldUpdate: {
        entities: resolved.length,
        byType: perType,
      },
      preview: resolved.map(r => ({
        id: r.row.id,
        type: r.row.type,
        name: r.update.name?.trim() ?? r.row.name,
        ...(r.update.description !== undefined ? { description: r.update.description.trim() || null } : {}),
        ...(r.metadata !== undefined ? { metadata: r.metadata } : {}),
        ...(r.update.folder !== undefined ? { folder: r.update.folder || null } : {}),
        ...(r.update.tags !== undefined ? { tags: r.update.tags.map(normaliseTagName) } : {}),
      })),
    }
  }

  // ==========================================================================
  // COMMIT — single transaction
  // ==========================================================================
  const findFolder = db.prepare('SELECT id FROM entity_folders WHERE campaign_id = ? AND entity_type = ? AND name = ? AND deleted_at IS NULL')
  const insertFolder = db.prepare('INSERT INTO entity_folders (campaign_id, entity_type, name) VALUES (?, ?, ?)')
  const findTag = db.prepare('SELECT id, deleted_at FROM tags WHERE name = ?')
  const reviveTag = db.prepare('UPDATE tags SET deleted_at = NULL WHERE id = ?')
  const insertTag = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)')
  const clearTags = db.prepare('DELETE FROM entity_tags WHERE entity_id = ?')
  const attachTag = db.prepare('INSERT OR IGNORE INTO entity_tags (entity_id, tag_id) VALUES (?, ?)')

  const folderCache = new Map<string, number>()
  const tagCache = new Map<string, number>()

  db.exec('BEGIN')
  try {
    for (const { update: u, row, metadata } of resolved) {
      // Build a targeted UPDATE with only the provided columns.
      const sets: string[] = []
      const params: unknown[] = []
      if (u.name !== undefined) {
        sets.push('name = ?')
        params.push(u.name.trim())
      }
      if (u.description !== undefined) {
        sets.push('description = ?')
        params.push(u.description.trim() || null)
      }
      if (metadata !== undefined) {
        sets.push('metadata = ?')
        params.push(Object.keys(metadata).length ? JSON.stringify(metadata) : null)
      }
      if (u.folder !== undefined) {
        let folderId: number | null = null
        const folderType = entityTypeToFolderType(row.type)
        if (u.folder && folderType) {
          const key = `${folderType}:${u.folder}`
          if (folderCache.has(key)) folderId = folderCache.get(key)!
          else {
            const existing = findFolder.get(campaignId, folderType, u.folder) as { id: number } | undefined
            folderId = existing
              ? existing.id
              : Number(insertFolder.run(campaignId, folderType, u.folder).lastInsertRowid)
            folderCache.set(key, folderId)
          }
        }
        sets.push('folder_id = ?')
        params.push(folderId)
      }

      if (sets.length > 0) {
        sets.push('updated_at = datetime(\'now\')')
        db.prepare(`UPDATE entities SET ${sets.join(', ')} WHERE id = ?`).run(...params, row.id)
      }

      // Tags: replace the whole set when provided.
      if (u.tags !== undefined) {
        clearTags.run(row.id)
        for (const raw of u.tags) {
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
          attachTag.run(row.id, tagId)
        }
      }
    }

    db.exec('COMMIT')

    recordImport(campaignId, perType, 'update')

    return {
      dryRun: false,
      updated: { entities: resolved.length, byType: perType },
      ids: resolved.map(r => r.row.id),
    }
  }
  catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
})
