import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Item rarity ID is required',
    })
  }

  const { name, name_de, name_en } = body

  // Check if rarity exists
  const existing = db
    .prepare(
      `
    SELECT id FROM item_rarities WHERE id = ? AND deleted_at IS NULL
  `,
    )
    .get(id)

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Item rarity not found',
    })
  }

  // Check if name conflicts with another rarity
  if (name) {
    const conflict = db
      .prepare(
        `
      SELECT id FROM item_rarities WHERE name = ? AND id != ? AND deleted_at IS NULL
    `,
      )
      .get(name, id)

    if (conflict) {
      throw createError({
        statusCode: 409,
        message: 'Item rarity with this name already exists',
      })
    }
  }

  db.prepare(
    `
    UPDATE item_rarities
    SET
      name = COALESCE(?, name),
      name_de = COALESCE(?, name_de),
      name_en = COALESCE(?, name_en)
    WHERE id = ? AND deleted_at IS NULL
  `,
  ).run(name, name_de, name_en, id)

  const itemRarity = db
    .prepare(
      `
    SELECT * FROM item_rarities WHERE id = ?
  `,
    )
    .get(id)

  return itemRarity
})
