import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody(event)

  const { name, description, metadata, campaignId } = body

  if (!name || !campaignId) {
    throw createError({
      statusCode: 400,
      message: 'Name and Campaign ID are required',
    })
  }

  // Get NPC entity type ID
  const entityType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as { id: number } | undefined

  if (!entityType) {
    throw createError({
      statusCode: 500,
      message: 'NPC entity type not found',
    })
  }

  const result = db.prepare(`
    INSERT INTO entities (type_id, campaign_id, name, description, metadata)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    entityType.id,
    campaignId,
    name,
    description || null,
    metadata ? JSON.stringify(metadata) : null,
  )

  const npc = db.prepare(`
    SELECT * FROM entities WHERE id = ?
  `).get(result.lastInsertRowid)

  return {
    ...npc,
    metadata: npc.metadata ? JSON.parse(npc.metadata as string) : null,
  }
})
