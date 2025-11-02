import { getDb } from '../../utils/db'

export default defineEventHandler((event) => {
  const db = getDb()
  const query = getQuery(event)
  const fromEntityId = query.from_entity_id as string
  const toEntityId = query.to_entity_id as string

  if (!fromEntityId || !toEntityId) {
    throw createError({
      statusCode: 400,
      message: 'from_entity_id and to_entity_id are required',
    })
  }

  // Find the relation
  const relation = db.prepare(`
    SELECT id, from_entity_id, to_entity_id, relation_type
    FROM entity_relations
    WHERE from_entity_id = ? AND to_entity_id = ?
    LIMIT 1
  `).get(fromEntityId, toEntityId) as {
    id: number
    from_entity_id: number
    to_entity_id: number
    relation_type: string
  } | undefined

  if (!relation) {
    return null
  }

  return relation
})
