import { getDb } from '../../../utils/db'
import type { CalendarSeason } from '~~/types/calendar'

export default defineEventHandler((event) => {
  const db = getDb()
  const query = getQuery(event)
  const campaignId = query.campaignId as string

  if (!campaignId) {
    throw createError({
      statusCode: 400,
      message: 'Campaign ID is required',
    })
  }

  const seasons = db
    .prepare(
      `
    SELECT * FROM calendar_seasons
    WHERE campaign_id = ?
    ORDER BY sort_order, start_month, start_day
  `,
    )
    .all(Number(campaignId)) as CalendarSeason[]

  return seasons
})
