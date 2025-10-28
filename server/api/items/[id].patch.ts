import { getDb } from '../../utils/db'
import type { ItemMetadata } from '../../../types/item'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Item ID is required',
    })
  }

  const { name, description, metadata } = body as {
    name?: string
    description?: string
    metadata?: ItemMetadata
  }

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

  const item = db.prepare(`
    SELECT * FROM entities WHERE id = ? AND deleted_at IS NULL
  `).get(id)

  if (!item) {
    throw createError({
      statusCode: 404,
      message: 'Item not found',
    })
  }

  return {
    ...item,
    metadata: item.metadata ? JSON.parse(item.metadata as string) : null,
  }
})
