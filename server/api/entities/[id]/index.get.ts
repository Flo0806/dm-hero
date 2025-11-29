import { getDb } from '../../../utils/db'

interface Entity {
  id: number
  name: string
  description: string | null
  image_url: string | null
  type_id: number
  parent_entity_id: number | null
  metadata: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

interface EntityType {
  id: number
  name: string
  icon: string
  color: string
}

export default defineEventHandler((event) => {
  const db = getDb()
  const id = Number(getRouterParam(event, 'id'))

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid entity ID',
    })
  }

  // Fetch entity with its type
  const entity = db
    .prepare(
      `
      SELECT
        e.id,
        e.name,
        e.description,
        e.image_url,
        e.type_id,
        e.parent_entity_id,
        e.metadata,
        e.created_at,
        e.updated_at,
        e.deleted_at
      FROM entities e
      WHERE e.id = ? AND e.deleted_at IS NULL
    `,
    )
    .get(id) as Entity | undefined

  if (!entity) {
    throw createError({
      statusCode: 404,
      message: 'Entity not found',
    })
  }

  // Fetch entity type
  const entityType = db
    .prepare(
      `
      SELECT id, name, icon, color
      FROM entity_types
      WHERE id = ?
    `,
    )
    .get(entity.type_id) as EntityType | undefined

  // Parse metadata if exists
  const parsedEntity = {
    ...entity,
    metadata: entity.metadata ? JSON.parse(entity.metadata) : null,
  }

  return {
    entity: parsedEntity,
    type: entityType || null,
  }
})
