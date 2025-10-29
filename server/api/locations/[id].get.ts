import { getDb } from '../../utils/db'

export default defineEventHandler((event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Location ID is required',
    })
  }

  // Get Location entity type ID
  const entityType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Location') as { id: number } | undefined

  if (!entityType) {
    throw createError({
      statusCode: 404,
      message: 'Location entity type not found',
    })
  }

  // Get the location
  const location = db.prepare(`
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

  if (!location) {
    throw createError({
      statusCode: 404,
      message: 'Location not found',
    })
  }

  const metadata = location.metadata ? JSON.parse(location.metadata as string) : {}

  return {
    id: location.id,
    name: location.name,
    description: location.description,
    image_url: location.image_url,
    created_at: location.created_at,
    updated_at: location.updated_at,
    ...metadata,
  }
})
