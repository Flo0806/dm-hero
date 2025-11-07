import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody(event)

  const { name, name_de, name_en, description } = body

  if (!name) {
    throw createError({
      statusCode: 400,
      message: 'Name is required',
    })
  }

  // For custom classes, both translations are required
  if (!name_de || !name_en) {
    throw createError({
      statusCode: 400,
      message: 'Both German (name_de) and English (name_en) translations are required',
    })
  }

  // Check if class with same name already exists (including soft-deleted)
  const existing = db
    .prepare(
      `
    SELECT id FROM classes WHERE name = ? AND deleted_at IS NULL
  `,
    )
    .get(name)

  if (existing) {
    throw createError({
      statusCode: 409,
      message: 'Class with this name already exists',
    })
  }

  const result = db
    .prepare(
      `
    INSERT INTO classes (name, name_de, name_en, description)
    VALUES (?, ?, ?, ?)
  `,
    )
    .run(name, name_de, name_en, description || null)

  const classData = db
    .prepare(
      `
    SELECT * FROM classes WHERE id = ?
  `,
    )
    .get(result.lastInsertRowid)

  return classData
})
