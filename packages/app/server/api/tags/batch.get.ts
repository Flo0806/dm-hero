import { getDb } from '../../utils/db'
import type { Tag } from '../../../types/tag'

/**
 * Batch-fetch tags for many entities at once.
 * GET /api/tags/batch?entityIds=1,2,3
 * Returns { [entityId]: Tag[] } — empty arrays included for ids without tags.
 */
export default defineEventHandler((event): Record<number, Tag[]> => {
  const query = getQuery(event)
  const raw = String(query.entityIds ?? '').trim()
  if (!raw) return {}

  const ids = raw
    .split(',')
    .map(s => Number(s.trim()))
    .filter(n => Number.isFinite(n))

  if (ids.length === 0) return {}

  const db = getDb()
  const placeholders = ids.map(() => '?').join(',')

  const rows = db.prepare(`
    SELECT et.entity_id, t.id, t.name, t.color
    FROM entity_tags et
    JOIN tags t ON t.id = et.tag_id
    WHERE et.entity_id IN (${placeholders}) AND t.deleted_at IS NULL
    ORDER BY t.name COLLATE NOCASE
  `).all(...ids) as Array<{ entity_id: number, id: number, name: string, color: string | null }>

  const out: Record<number, Tag[]> = {}
  for (const id of ids) out[id] = []
  for (const r of rows) {
    out[r.entity_id]!.push({ id: r.id, name: r.name, color: r.color })
  }
  return out
})
