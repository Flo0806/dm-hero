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
    SELECT * FROM entities
    WHERE type_id = ? AND campaign_id = ? AND deleted_at IS NULL
    ORDER BY name ASC
  `).all(entityType.id, campaignId)

  return locations.map((location: any) => ({
    ...location,
    metadata: location.metadata ? JSON.parse(location.metadata) : null,
  }))
})
