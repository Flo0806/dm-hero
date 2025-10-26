import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody(event)

  const { fromEntityId, toEntityId, relationType, notes } = body

  if (!fromEntityId || !toEntityId || !relationType) {
    throw createError({
      statusCode: 400,
      message: 'fromEntityId, toEntityId, and relationType are required',
    })
  }

  try {
    const result = db.prepare(`
      INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type, notes)
      VALUES (?, ?, ?, ?)
    `).run(fromEntityId, toEntityId, relationType, notes || null)

    const relation = db.prepare(`
      SELECT * FROM entity_relations WHERE id = ?
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
