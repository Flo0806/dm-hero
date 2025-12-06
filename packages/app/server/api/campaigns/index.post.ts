import { getDb } from '../../utils/db'

// Default currencies for new campaigns (D&D standard)
// Names are i18n keys (copper, silver, gold, platinum) for frontend translation
const DEFAULT_CURRENCIES = [
  { code: 'CP', name: 'copper', symbol: 'CP', exchange_rate: 1, sort_order: 0, is_default: 0 },
  { code: 'SP', name: 'silver', symbol: 'SP', exchange_rate: 10, sort_order: 1, is_default: 0 },
  { code: 'GP', name: 'gold', symbol: 'GP', exchange_rate: 100, sort_order: 2, is_default: 1 },
  { code: 'PP', name: 'platinum', symbol: 'PP', exchange_rate: 1000, sort_order: 3, is_default: 0 },
]

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody(event)

  const { name, description } = body

  if (!name) {
    throw createError({
      statusCode: 400,
      message: 'Campaign name is required',
    })
  }

  const result = db
    .prepare(
      `
    INSERT INTO campaigns (name, description)
    VALUES (?, ?)
  `,
    )
    .run(name, description || null)

  const campaignId = result.lastInsertRowid

  // Insert default currencies for the new campaign
  const insertCurrency = db.prepare(`
    INSERT INTO currencies (campaign_id, code, name, symbol, exchange_rate, sort_order, is_default)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  for (const currency of DEFAULT_CURRENCIES) {
    insertCurrency.run(
      campaignId,
      currency.code,
      currency.name,
      currency.symbol,
      currency.exchange_rate,
      currency.sort_order,
      currency.is_default,
    )
  }

  const campaign = db
    .prepare(
      `
    SELECT * FROM campaigns WHERE id = ?
  `,
    )
    .get(campaignId)

  return campaign
})
