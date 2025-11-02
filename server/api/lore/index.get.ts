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

  // Get Lore entity type ID
  const entityType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Lore') as { id: number } | undefined

  if (!entityType) {
    return []
  }

  interface LoreRow {
    id: number
    name: string
    description: string | null
    image_url: string | null
    metadata: string | null
    created_at: string
    updated_at: string
  }

  let loreEntries: LoreRow[]

  // Simple search implementation (can be enhanced with FTS5 later)
  if (searchQuery && searchQuery.trim().length > 0) {
    const searchTerm = searchQuery.trim().toLowerCase()

    loreEntries = db.prepare<unknown[], LoreRow>(`
      SELECT e.id, e.name, e.description, e.metadata, e.created_at, e.updated_at,
             ei.image_url
      FROM entities e
      LEFT JOIN (
        SELECT entity_id, image_url
        FROM entity_images
        WHERE is_primary = 1
      ) ei ON ei.entity_id = e.id
      WHERE e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
        AND (
          LOWER(e.name) LIKE ?
          OR LOWER(e.description) LIKE ?
        )
      ORDER BY e.updated_at DESC
    `).all(
      entityType.id,
      campaignId,
      `%${searchTerm}%`,
      `%${searchTerm}%`,
    )
  }
  else {
    // No search - return all lore entries
    loreEntries = db.prepare<unknown[], LoreRow>(`
      SELECT e.id, e.name, e.description, e.metadata, e.created_at, e.updated_at,
             ei.image_url
      FROM entities e
      LEFT JOIN (
        SELECT entity_id, image_url
        FROM entity_images
        WHERE is_primary = 1
      ) ei ON ei.entity_id = e.id
      WHERE e.type_id = ?
        AND e.campaign_id = ?
        AND e.deleted_at IS NULL
      ORDER BY e.updated_at DESC
    `).all(entityType.id, campaignId)
  }

  // Parse metadata JSON
  return loreEntries.map(lore => ({
    ...lore,
    metadata: lore.metadata ? JSON.parse(lore.metadata) : null,
  }))
})
