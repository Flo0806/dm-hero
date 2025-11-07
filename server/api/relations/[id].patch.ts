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

  const { relationType, notes } = body as {
    relationType?: string
    notes?: Record<string, unknown>
  }

  db.prepare(
    `
    UPDATE entity_relations
    SET
      relation_type = COALESCE(?, relation_type),
      notes = COALESCE(?, notes)
    WHERE id = ?
  `,
  ).run(relationType, notes ? JSON.stringify(notes) : null, id)

  interface DbRelation {
    id: number
    from_entity_id: number
    to_entity_id: number
    relation_type: string
    notes: string | null
    created_at: string
    to_entity_name: string
    to_entity_type: string
  }

  const relation = db
    .prepare<unknown[], DbRelation>(
      `
    SELECT
      er.id,
      er.from_entity_id,
      er.to_entity_id,
      er.relation_type,
      er.notes,
      er.created_at,
      e.name as to_entity_name,
      et.name as to_entity_type
    FROM entity_relations er
    INNER JOIN entities e ON er.to_entity_id = e.id
    INNER JOIN entity_types et ON e.type_id = et.id
    WHERE er.id = ?
  `,
    )
    .get(id)

  if (!relation) {
    throw createError({
      statusCode: 404,
      message: 'Relation not found',
    })
  }

  return {
    ...relation,
    notes: relation.notes ? JSON.parse(relation.notes) : null,
  }
})
