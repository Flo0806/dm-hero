import { getDb } from '../../../utils/db'
import type { Tag } from '../../../../types/tag'

export default defineEventHandler((event): Tag[] => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) return []

  const db = getDb()
  return db.prepare(`
    SELECT t.id, t.name, t.color
    FROM tags t
    JOIN entity_tags et ON et.tag_id = t.id
    WHERE et.entity_id = ? AND t.deleted_at IS NULL
    ORDER BY t.name COLLATE NOCASE
  `).all(id) as Tag[]
})
