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

  // Check if race with same name already exists (including soft-deleted)
  const existing = db.prepare(`
    SELECT id FROM races WHERE name = ? AND deleted_at IS NULL
  `).get(name)

  if (existing) {
    throw createError({
      statusCode: 409,
      message: 'Race with this name already exists',
    })
  }

  const result = db.prepare(`
    INSERT INTO races (name, description)
    VALUES (?, ?)
  `).run(name, description || null)

  const race = db.prepare(`
    SELECT * FROM races WHERE id = ?
  `).get(result.lastInsertRowid)

  return race
})
