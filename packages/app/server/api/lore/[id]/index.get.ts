import { getDb } from '../../../utils/db'
import type { EntityTypeRow, EntityRow } from '../../../types/database'

export default defineEventHandler((event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Lore ID is required',
    })
  }

  // Get Lore entity type ID
  const entityType = db
    .prepare<[string], EntityTypeRow>('SELECT id FROM entity_types WHERE name = ?')
    .get('Lore')

  if (!entityType) {
    throw createError({
      statusCode: 404,
      message: 'Lore entity type not found',
    })
  }

  // Get the lore entry
  const lore = db
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

  if (!lore) {
    throw createError({
      statusCode: 404,
      message: 'Lore entry not found',
    })
  }

  const metadata = lore.metadata ? JSON.parse(lore.metadata as string) : {}

  return {
    id: lore.id,
    name: lore.name,
    description: lore.description,
    image_url: lore.image_url,
    created_at: lore.created_at,
    updated_at: lore.updated_at,
    ...metadata,
  }
})
