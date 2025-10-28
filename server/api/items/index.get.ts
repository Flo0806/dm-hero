import { getDb } from '../../utils/db'

export default defineEventHandler((event) => {
  const db = getDb()
  const query = getQuery(event)
  const campaignId = query.campaignId as string

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

  // Get all Items for this campaign
  const items = db.prepare(`
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

  return items.map(item => ({
    ...item,
    metadata: item.metadata ? JSON.parse(item.metadata as string) : null,
  }))
})
