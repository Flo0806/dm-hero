import { getDb } from '../../utils/db'

interface Currency {
  id: number
  campaign_id: number
  code: string
  name: string
  symbol: string | null
  exchange_rate: number
  sort_order: number
  is_default: number
  created_at: string
}

export default defineEventHandler((event) => {
  const db = getDb()
  const query = getQuery(event)
  const campaignId = query.campaignId

  if (!campaignId) {
    throw createError({
      statusCode: 400,
      message: 'Campaign ID is required',
    })
  }

  const currencies = db
    .prepare<unknown[], Currency>(
      `
      SELECT id, campaign_id, code, name, symbol, exchange_rate, sort_order, is_default, created_at
      FROM currencies
      WHERE campaign_id = ?
      ORDER BY sort_order ASC, name ASC
    `,
    )
    .all(campaignId)

  return currencies
})
