import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Location ID is required',
    })
  }

  const { name, description, metadata } = body

  db.prepare(`
    UPDATE entities
    SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      metadata = COALESCE(?, metadata),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND deleted_at IS NULL
  `).run(
    name,
    description,
    metadata ? JSON.stringify(metadata) : null,
    id,
  )

  const location = db.prepare(`
    SELECT * FROM entities WHERE id = ? AND deleted_at IS NULL
  `).get(id)

  if (!location) {
    throw createError({
      statusCode: 404,
      message: 'Location not found',
    })
  }

  return {
    ...location,
    metadata: location.metadata ? JSON.parse(location.metadata as string) : null,
  }
})
