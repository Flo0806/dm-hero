import { distance } from 'fastest-levenshtein'
import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
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

  // Get Location entity type
  const entityType = db.prepare(`
    SELECT id FROM entity_types WHERE name = 'Location'
  `).get() as { id: number } | undefined

  if (!entityType) {
    throw createError({
      statusCode: 500,
      message: 'Location entity type not found',
    })
  }

  let locations

  // Use FTS5 if search query provided
  if (searchQuery && searchQuery.trim().length > 0) {
    const ftsQuery = `${searchQuery.trim()}*`
    const searchTerm = searchQuery.trim().toLowerCase()

    // Use FTS5 with BM25 weighted scoring (name=10x, description=1x, metadata=0.5x)
    locations = db.prepare(`
      SELECT
        e.*,
        ei.image_url as primary_image_url,
        bm25(entities_fts, 10.0, 1.0, 0.5) as fts_score
      FROM entities_fts fts
      INNER JOIN entities e ON fts.rowid = e.id
      LEFT JOIN entity_images ei ON e.id = ei.entity_id AND ei.is_primary = 1
      WHERE entities_fts MATCH ?
        AND e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
      ORDER BY fts_score
      LIMIT 100
    `).all(ftsQuery, entityType.id, campaignId)

    // Apply Levenshtein distance ranking for better typo handling
    locations = locations.map((location: any) => {
      const nameDistance = distance(searchTerm, location.name.toLowerCase())
      const finalScore = location.fts_score + nameDistance
      return {
        ...location,
        _levenshtein_distance: nameDistance,
        _final_score: finalScore,
      }
    })

    // Sort by final score (lower is better)
    locations.sort((a: any, b: any) => a._final_score - b._final_score)

    // Remove scoring metadata from results
    locations = locations.map(({ fts_score, _levenshtein_distance, _final_score, ...location }: any) => location)
  }
  else {
    // Get all Locations for this campaign (no search)
    locations = db.prepare(`
      SELECT
        e.*,
        ei.image_url as primary_image_url
      FROM entities e
      LEFT JOIN entity_images ei ON e.id = ei.entity_id AND ei.is_primary = 1
      WHERE e.type_id = ? AND e.campaign_id = ? AND e.deleted_at IS NULL
      ORDER BY e.name ASC
    `).all(entityType.id, campaignId)
  }

  return locations.map((location: any) => ({
    ...location,
    image_url: location.primary_image_url || location.image_url, // Fallback to old image_url
    metadata: location.metadata ? JSON.parse(location.metadata) : null,
  }))
})
