import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const npcId = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!npcId) {
    throw createError({
      statusCode: 400,
      message: 'NPC ID is required',
    })
  }

  const { toEntityId, relationType, notes } = body as {
    toEntityId: number
    relationType: string
    notes?: Record<string, unknown>
  }

  if (!toEntityId || !relationType) {
    throw createError({
      statusCode: 400,
      message: 'toEntityId and relationType are required',
    })
  }

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

  try {
    const result = db
      .prepare(
        `
      INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type, notes)
      VALUES (?, ?, ?, ?)
    `,
      )
      .run(npcId, toEntityId, relationType, notes ? JSON.stringify(notes) : null)

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
      .get(result.lastInsertRowid)

    if (!relation) {
      throw createError({
        statusCode: 500,
        message: 'Failed to create relation',
      })
    }

    return {
      ...relation,
      notes: relation.notes ? JSON.parse(relation.notes) : null,
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw createError({
        statusCode: 409,
        message: 'This relation already exists',
      })
    }
    throw error
  }
})
