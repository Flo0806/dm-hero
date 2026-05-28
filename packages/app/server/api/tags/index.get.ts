import { getDb } from '../../utils/db'

export interface TagWithUsage {
  id: number
  name: string
  color: string | null
  usage_count: number
}

export default defineEventHandler((): TagWithUsage[] => {
  const db = getDb()

  return db.prepare(`
    SELECT
      t.id,
      t.name,
      t.color,
      -- Count via e.id so soft-deleted entities (NULLed by the LEFT JOIN below)
      -- don't inflate the number.
      COUNT(DISTINCT e.id) AS usage_count
    FROM tags t
    LEFT JOIN entity_tags et ON et.tag_id = t.id
    LEFT JOIN entities e ON e.id = et.entity_id AND e.deleted_at IS NULL
    WHERE t.deleted_at IS NULL
    GROUP BY t.id
    ORDER BY t.name COLLATE NOCASE
  `).all() as TagWithUsage[]
})
