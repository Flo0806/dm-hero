import { getDb } from '../../../utils/db'

export default defineEventHandler((event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Currency ID is required',
    })
  }

  // Check if currency exists
  const currency = db.prepare('SELECT id FROM currencies WHERE id = ?').get(id) as { id: number } | undefined

  if (!currency) {
    throw createError({
      statusCode: 404,
      message: 'Currency not found',
    })
  }

  // Count items using this currency
  const itemTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'Item'").get() as { id: number } | undefined

  let itemCount = 0
  if (itemTypeId) {
    const result = db
      .prepare(
        `
        SELECT COUNT(*) as count FROM entities
        WHERE type_id = ? AND deleted_at IS NULL
        AND json_extract(metadata, '$.currency_id') = ?
      `,
      )
      .get(itemTypeId.id, Number(id)) as { count: number }
    itemCount = result.count
  }

  return {
    currencyId: Number(id),
    itemCount,
  }
})
