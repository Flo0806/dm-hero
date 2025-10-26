import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Class ID is required',
    })
  }

  const { name, description } = body

  // Check if class exists
  const existing = db.prepare(`
    SELECT id FROM classes WHERE id = ? AND deleted_at IS NULL
  `).get(id)

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Class not found',
    })
  }

  // Check if name conflicts with another class
  if (name) {
    const conflict = db.prepare(`
      SELECT id FROM classes WHERE name = ? AND id != ? AND deleted_at IS NULL
    `).get(name, id)

    if (conflict) {
      throw createError({
        statusCode: 409,
        message: 'Class with this name already exists',
      })
    }
  }

  db.prepare(`
    UPDATE classes
    SET
      name = COALESCE(?, name),
      description = COALESCE(?, description)
    WHERE id = ? AND deleted_at IS NULL
  `).run(name, description, id)

  const classData = db.prepare(`
    SELECT * FROM classes WHERE id = ?
  `).get(id)

  return classData
})
