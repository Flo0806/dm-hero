import { distance } from 'fastest-levenshtein'
import { getDb } from '../../utils/db'

export default defineEventHandler((event) => {
  const db = getDb()
  const query = getQuery(event)
  const campaignId = query.campaignId as string
  const searchQuery = query.search as string | undefined

  if (!campaignId) {
    throw createError({
      statusCode: 400,
      message: 'Campaign ID is required',
    })
  }

  // Get Item entity type ID
  const entityType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Item') as { id: number } | undefined

  if (!entityType) {
    return []
  }

  let items

  // Use FTS5 if search query provided
  if (searchQuery && searchQuery.trim().length > 0) {
    const ftsQuery = `${searchQuery.trim()}*`
    const searchTerm = searchQuery.trim().toLowerCase()

    // Use FTS5 with BM25 weighted scoring (name=10x, description=1x, metadata=0.5x)
    items = db.prepare(`
      SELECT
        e.id,
        e.name,
        e.description,
        e.image_url,
        e.metadata,
        e.created_at,
        e.updated_at,
        bm25(entities_fts, 10.0, 1.0, 0.5) as fts_score
      FROM entities_fts fts
      INNER JOIN entities e ON fts.rowid = e.id
      WHERE entities_fts MATCH ?
        AND e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
      ORDER BY fts_score
      LIMIT 100
    `).all(ftsQuery, entityType.id, campaignId)

    // Apply Levenshtein distance ranking for better typo handling
    items = items.map((item: any) => {
      const nameDistance = distance(searchTerm, item.name.toLowerCase())
      const finalScore = item.fts_score + nameDistance
      return {
        ...item,
        _levenshtein_distance: nameDistance,
        _final_score: finalScore,
      }
    })

    // Sort by final score (lower is better)
    items.sort((a: any, b: any) => a._final_score - b._final_score)

    // Remove scoring metadata from results
    items = items.map(({ fts_score, _levenshtein_distance, _final_score, ...item }: any) => item)
  }
  else {
    // Get all Items for this campaign (no search)
    items = db.prepare(`
      SELECT
        e.id,
        e.name,
        e.description,
        e.image_url,
        e.metadata,
        e.created_at,
        e.updated_at
      FROM entities e
      WHERE e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
      ORDER BY e.name ASC
    `).all(entityType.id, campaignId)
  }

  return items.map(item => ({
    ...item,
    metadata: item.metadata ? JSON.parse(item.metadata as string) : null,
  }))
})
