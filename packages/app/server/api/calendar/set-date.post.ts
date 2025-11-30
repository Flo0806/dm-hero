import { getDb } from '../../utils/db'

interface DateInput {
  campaignId: number
  year: number
  month: number
  day: number
}

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody<DateInput>(event)

  if (!body.campaignId || body.year === undefined || !body.month || !body.day) {
    throw createError({
      statusCode: 400,
      message: 'Campaign ID, year, month, and day are required',
    })
  }

  db.prepare(`
    UPDATE calendar_config
    SET current_year = ?, current_month = ?, current_day = ?, updated_at = CURRENT_TIMESTAMP
    WHERE campaign_id = ?
  `).run(body.year, body.month, body.day, body.campaignId)

  return { success: true }
})
