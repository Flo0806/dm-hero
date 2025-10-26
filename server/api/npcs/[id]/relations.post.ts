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

  const { toEntityId, relationType, notes } = body

  if (!toEntityId || !relationType) {
    throw createError({
      statusCode: 400,
      message: 'toEntityId and relationType are required',
    })
  }

  try {
    const result = db.prepare(`
      INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type, notes)
      VALUES (?, ?, ?, ?)
    `).run(npcId, toEntityId, relationType, notes || null)

    const relation = db.prepare(`
      SELECT
        er.*,
        e.name as to_entity_name,
        et.name as to_entity_type
      FROM entity_relations er
      INNER JOIN entities e ON er.to_entity_id = e.id
      INNER JOIN entity_types et ON e.type_id = et.id
      WHERE er.id = ?
    `).get(result.lastInsertRowid)

    return relation
  }
  catch (error: any) {
    if (error.message.includes('UNIQUE constraint failed')) {
      throw createError({
        statusCode: 409,
        message: 'This relation already exists',
      })
    }
    throw error
  }
})
