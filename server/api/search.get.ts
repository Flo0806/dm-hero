import { getDb } from '../utils/db'

export default defineEventHandler((event) => {
  const db = getDb()
  const query = getQuery(event)
  const searchQuery = query.q as string
  const campaignId = query.campaignId as string

  if (!searchQuery || !campaignId) {
    return []
  }

  // Prepare FTS5 query with wildcard for prefix matching
  // FTS5 requires special syntax: use * for prefix matching
  const ftsQuery = `${searchQuery.trim()}*`

  // Use FTS5 for full-text search
  const results = db.prepare(`
    SELECT
      e.id,
      e.name,
      e.description,
      et.name as entity_type,
      et.icon,
      et.color
    FROM entities_fts fts
    INNER JOIN entities e ON fts.rowid = e.id
    INNER JOIN entity_types et ON e.type_id = et.id
    WHERE entities_fts MATCH ?
      AND e.campaign_id = ?
      AND e.deleted_at IS NULL
    ORDER BY rank
    LIMIT 20
  `).all(ftsQuery, campaignId)

  return results.map((result: any) => ({
    id: result.id,
    name: result.name,
    description: result.description,
    type: result.entity_type,
    icon: result.icon,
    color: result.color,
  }))
})
