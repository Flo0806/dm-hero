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

  // Get Faction entity type ID
  const entityType = db.prepare<unknown[], { id: number }>('SELECT id FROM entity_types WHERE name = ?').get('Faction')

  if (!entityType) {
    return []
  }

  interface DbEntity {
    id: number
    name: string
    description: string | null
    image_url: string | null
    metadata: string | null
    created_at: string
    updated_at: string
  }

  let factions

  // Use FTS5 if search query provided
  if (searchQuery && searchQuery.trim().length > 0) {
    const ftsQuery = `${searchQuery.trim()}*`
    const searchTerm = searchQuery.trim().toLowerCase()

    // Use FTS5 with BM25 weighted scoring (name=10x, description=1x, metadata=0.5x)
    factions = db.prepare<unknown[], DbEntity & { fts_score: number }>(`
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
    factions = factions.map((faction: any) => {
      const nameDistance = distance(searchTerm, faction.name.toLowerCase())
      const finalScore = faction.fts_score + nameDistance
      return {
        ...faction,
        _levenshtein_distance: nameDistance,
        _final_score: finalScore,
      }
    })

    // Sort by final score (lower is better)
    factions.sort((a: any, b: any) => a._final_score - b._final_score)

    // Remove scoring metadata from results
    factions = factions.map(({ fts_score, _levenshtein_distance, _final_score, ...faction }: any) => faction)
  }
  else {
    // Get all Factions for this campaign (no search)
    factions = db.prepare<unknown[], DbEntity>(`
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

  return factions.map(faction => ({
    ...faction,
    metadata: faction.metadata ? JSON.parse(faction.metadata) : null,
  }))
})
