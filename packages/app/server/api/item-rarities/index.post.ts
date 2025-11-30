import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody(event)

  const { name, name_de, name_en, description: _description } = body

  if (!name) {
    throw createError({
      statusCode: 400,
      message: 'Name is required',
    })
  }

  // For custom rarities, both translations are required
  if (!name_de || !name_en) {
    throw createError({
      statusCode: 400,
      message: 'Both German (name_de) and English (name_en) translations are required',
    })
  }

  // Check if rarity with same name already exists (including soft-deleted)
  const existing = db
    .prepare(
      `
    SELECT id FROM item_rarities WHERE name = ? AND deleted_at IS NULL
  `,
    )
    .get(name)

  if (existing) {
    throw createError({
      statusCode: 409,
      message: 'Item rarity with this name already exists',
    })
  }

  const result = db
    .prepare(
      `
    INSERT INTO item_rarities (name, name_de, name_en)
    VALUES (?, ?, ?)
  `,
    )
    .run(name, name_de, name_en)

  const itemRarity = db
    .prepare(
      `
    SELECT * FROM item_rarities WHERE id = ?
  `,
    )
    .get(result.lastInsertRowid)

  return itemRarity
})
