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

  // Check if currency exists and get info
  const currency = db
    .prepare('SELECT id, campaign_id, is_default, code FROM currencies WHERE id = ?')
    .get(id) as { id: number; campaign_id: number; is_default: number; code: string } | undefined

  if (!currency) {
    throw createError({
      statusCode: 404,
      message: 'Currency not found',
    })
  }

  // Count items using this currency (stored in metadata as currency_id)
  // Items store value in metadata JSON, we need to check for currency_id
  const itemTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'Item'").get() as { id: number } | undefined

  let itemsUsingCurrency = 0
  if (itemTypeId) {
    const items = db
      .prepare(
        `
        SELECT COUNT(*) as count FROM entities
        WHERE type_id = ? AND deleted_at IS NULL
        AND json_extract(metadata, '$.currency_id') = ?
      `,
      )
      .get(itemTypeId.id, Number(id)) as { count: number }
    itemsUsingCurrency = items.count
  }

  // Delete the currency
  db.prepare('DELETE FROM currencies WHERE id = ?').run(id)

  // If this was the default, set another one as default
  if (currency.is_default) {
    const firstOther = db
      .prepare('SELECT id FROM currencies WHERE campaign_id = ? ORDER BY sort_order LIMIT 1')
      .get(currency.campaign_id) as { id: number } | undefined

    if (firstOther) {
      db.prepare('UPDATE currencies SET is_default = 1 WHERE id = ?').run(firstOther.id)
    }
  }

  return {
    success: true,
    itemsAffected: itemsUsingCurrency,
  }
})
