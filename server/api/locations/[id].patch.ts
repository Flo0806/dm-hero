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

  const { name, description, metadata, parentLocationId } = body

  db.prepare(`
    UPDATE entities
    SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      metadata = COALESCE(?, metadata),
      parent_entity_id = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND deleted_at IS NULL
  `).run(
    name,
    description,
    metadata ? JSON.stringify(metadata) : null,
    parentLocationId !== undefined ? parentLocationId : null,
    id,
  )

  interface LocationRow {
    id: number
    name: string
    description: string | null
    metadata: string | null
    parent_entity_id: number | null
    created_at: string
    updated_at: string
  }

  const location = db.prepare<unknown[], LocationRow>(`
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
    metadata: location.metadata ? JSON.parse(location.metadata) : null,
  }
})
