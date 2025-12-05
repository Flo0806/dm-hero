import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Entity ID is required',
    })
  }

  const { location_id } = body as {
    location_id: number | null
  }

  // Update the entity's location_id
  db.prepare(
    `
    UPDATE entities
    SET location_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND deleted_at IS NULL
  `,
  ).run(location_id, id)

  // Return the updated entity
  interface DbEntity {
    id: number
    name: string
    location_id: number | null
  }

  const entity = db
    .prepare<unknown[], DbEntity>(
      `
    SELECT id, name, location_id
    FROM entities
    WHERE id = ? AND deleted_at IS NULL
  `,
    )
    .get(id)

  if (!entity) {
    throw createError({
      statusCode: 404,
      message: 'Entity not found',
    })
  }

  return entity
})
