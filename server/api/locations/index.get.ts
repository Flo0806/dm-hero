import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const query = getQuery(event)
  const campaignId = query.campaignId as string

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

  const locations = db.prepare(`
    SELECT
      e.*,
      ei.image_url as primary_image_url
    FROM entities e
    LEFT JOIN entity_images ei ON e.id = ei.entity_id AND ei.is_primary = 1
    WHERE e.type_id = ? AND e.campaign_id = ? AND e.deleted_at IS NULL
    ORDER BY e.name ASC
  `).all(entityType.id, campaignId)

  return locations.map((location: any) => ({
    ...location,
    image_url: location.primary_image_url || location.image_url, // Fallback to old image_url
    metadata: location.metadata ? JSON.parse(location.metadata) : null,
  }))
})
