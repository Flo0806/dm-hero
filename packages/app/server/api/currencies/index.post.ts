import { getDb } from '../../utils/db'

interface CreateCurrencyBody {
  campaignId: number
  code: string
  name: string
  symbol?: string
  exchange_rate: number
  sort_order?: number
  is_default?: boolean
}

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody<CreateCurrencyBody>(event)

  if (!body.campaignId || !body.code || !body.name || body.exchange_rate === undefined) {
    throw createError({
      statusCode: 400,
      message: 'Campaign ID, code, name, and exchange_rate are required',
    })
  }

  // Get max sort_order for this campaign
  const maxOrder = db
    .prepare('SELECT MAX(sort_order) as max_order FROM currencies WHERE campaign_id = ?')
    .get(body.campaignId) as { max_order: number | null }

  const sortOrder = body.sort_order ?? (maxOrder.max_order ?? -1) + 1

  // If this is set as default, unset other defaults
  if (body.is_default) {
    db.prepare('UPDATE currencies SET is_default = 0 WHERE campaign_id = ?').run(body.campaignId)
  }

  const result = db
    .prepare(
      `
      INSERT INTO currencies (campaign_id, code, name, symbol, exchange_rate, sort_order, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      body.campaignId,
      body.code.toUpperCase(),
      body.name,
      body.symbol || body.code.toUpperCase(),
      body.exchange_rate,
      sortOrder,
      body.is_default ? 1 : 0,
    )

  return {
    id: result.lastInsertRowid,
    campaign_id: body.campaignId,
    code: body.code.toUpperCase(),
    name: body.name,
    symbol: body.symbol || body.code.toUpperCase(),
    exchange_rate: body.exchange_rate,
    sort_order: sortOrder,
    is_default: body.is_default ? 1 : 0,
  }
})
