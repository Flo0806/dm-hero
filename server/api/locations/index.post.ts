import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody(event)

  const { name, description, metadata, campaignId } = body

  if (!name || !campaignId) {
    throw createError({
      statusCode: 400,
      message: 'Name and campaign ID are required',
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

  const result = db.prepare(`
    INSERT INTO entities (type_id, name, description, metadata, campaign_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    entityType.id,
    name,
    description || null,
    metadata ? JSON.stringify(metadata) : null,
    campaignId,
  )

  const location = db.prepare(`
    SELECT * FROM entities WHERE id = ?
  `).get(result.lastInsertRowid)

  return {
    ...location,
    metadata: location.metadata ? JSON.parse(location.metadata as string) : null,
  }
})
