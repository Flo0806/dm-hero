import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Relation ID is required',
    })
  }

  const { relationType, notes } = body

  db.prepare(`
    UPDATE entity_relations
    SET
      relation_type = COALESCE(?, relation_type),
      notes = COALESCE(?, notes)
    WHERE id = ?
  `).run(relationType, notes, id)

  const relation = db.prepare(`
    SELECT
      er.*,
      e.name as to_entity_name,
      et.name as to_entity_type
    FROM entity_relations er
    INNER JOIN entities e ON er.to_entity_id = e.id
    INNER JOIN entity_types et ON e.type_id = et.id
    WHERE er.id = ?
  `).get(id)

  if (!relation) {
    throw createError({
      statusCode: 404,
      message: 'Relation not found',
    })
  }

  return relation
})
