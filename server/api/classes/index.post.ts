import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody(event)

  const { name, description } = body

  if (!name) {
    throw createError({
      statusCode: 400,
      message: 'Name is required',
    })
  }

  // Check if class with same name already exists (including soft-deleted)
  const existing = db.prepare(`
    SELECT id FROM classes WHERE name = ? AND deleted_at IS NULL
  `).get(name)

  if (existing) {
    throw createError({
      statusCode: 409,
      message: 'Class with this name already exists',
    })
  }

  const result = db.prepare(`
    INSERT INTO classes (name, description)
    VALUES (?, ?)
  `).run(name, description || null)

  const classData = db.prepare(`
    SELECT * FROM classes WHERE id = ?
  `).get(result.lastInsertRowid)

  return classData
})
