import { getDb } from '../../utils/db'

export default defineEventHandler((event) => {
  const db = getDb()
  const query = getQuery(event)
  // Support both camelCase and snake_case
  const fromEntityId = (query.fromEntityId || query.from_entity_id) as string
  const toEntityId = (query.toEntityId || query.to_entity_id) as string

  if (!fromEntityId || !toEntityId) {
    throw createError({
      statusCode: 400,
      message: 'fromEntityId and toEntityId are required',
    })
  }

  // Find the relation (search bidirectionally)
  const relation = db
    .prepare(
      `
    SELECT id, from_entity_id, to_entity_id, relation_type
    FROM entity_relations
    WHERE (from_entity_id = ? AND to_entity_id = ?)
       OR (from_entity_id = ? AND to_entity_id = ?)
    LIMIT 1
  `,
    )
    .get(fromEntityId, toEntityId, toEntityId, fromEntityId) as
    | {
        id: number
        from_entity_id: number
        to_entity_id: number
        relation_type: string
      }
    | undefined

  if (!relation) {
    return null
  }

  return relation
})
