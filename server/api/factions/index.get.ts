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

  // Get all Factions for this campaign
  const factions = db.prepare<unknown[], DbEntity>(`
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

  return factions.map(faction => ({
    ...faction,
    metadata: faction.metadata ? JSON.parse(faction.metadata) : null,
  }))
})
