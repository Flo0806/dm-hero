import { getDb } from '../../../utils/db'
import type { EntityTypeRow, EntityRow } from '../../../types/database'

export default defineEventHandler((event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Item ID is required',
    })
  }

  // Get Item entity type ID
  const entityType = db
    .prepare<[string], EntityTypeRow>('SELECT id FROM entity_types WHERE name = ?')
    .get('Item')

  if (!entityType) {
    throw createError({
      statusCode: 404,
      message: 'Item entity type not found',
    })
  }

  // Get the item
  const item = db
    .prepare<[string, number], EntityRow>(
      `
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
  `,
    )
    .get(id, entityType.id)

  if (!item) {
    throw createError({
      statusCode: 404,
      message: 'Item not found',
    })
  }

  const metadata = item.metadata ? JSON.parse(item.metadata as string) : {}

  return {
    id: item.id,
    name: item.name,
    description: item.description,
    image_url: item.image_url,
    created_at: item.created_at,
    updated_at: item.updated_at,
    ...metadata,
  }
})
