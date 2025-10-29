import { getDb } from '../../utils/db'

export default defineEventHandler((event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Faction ID is required',
    })
  }

  // Get Faction entity type ID
  const entityType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Faction') as { id: number } | undefined

  if (!entityType) {
    throw createError({
      statusCode: 404,
      message: 'Faction entity type not found',
    })
  }

  // Get the faction
  const faction = db.prepare(`
    SELECT
      e.id,
      e.name,
      e.description,
      e.image_url,
      e.metadata,
      e.created_at,
      e.updated_at
    FROM entities e
    WHERE e.id = ?
      AND e.type_id = ?
      AND e.deleted_at IS NULL
  `).get(id, entityType.id)

  if (!faction) {
    throw createError({
      statusCode: 404,
      message: 'Faction not found',
    })
  }

  const metadata = faction.metadata ? JSON.parse(faction.metadata as string) : {}

  return {
    id: faction.id,
    name: faction.name,
    description: faction.description,
    image_url: faction.image_url,
    created_at: faction.created_at,
    updated_at: faction.updated_at,
    ...metadata,
  }
})
