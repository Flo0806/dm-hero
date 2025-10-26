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

  // Get NPC entity type ID
  const entityType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as { id: number } | undefined

  if (!entityType) {
    return []
  }

  // Get all NPCs for this campaign
  const npcs = db.prepare(`
    SELECT
      e.id,
      e.name,
      e.description,
      e.metadata,
      e.created_at,
      e.updated_at
    FROM entities e
    WHERE e.type_id = ?
      AND e.campaign_id = ?
      AND e.deleted_at IS NULL
    ORDER BY e.name ASC
  `).all(entityType.id, campaignId)

  return npcs.map(npc => ({
    ...npc,
    metadata: npc.metadata ? JSON.parse(npc.metadata as string) : null,
  }))
})
