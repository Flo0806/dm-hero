import { getDb } from '~~/server/utils/db'

interface CalendarWeather {
  id: number
  campaign_id: number
  year: number
  month: number
  day: number
  weather_type: string
  temperature: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export default defineEventHandler(async (event) => {
  const db = getDb()
  const query = getQuery(event)

  const campaignId = Number(query.campaignId)
  const year = Number(query.year)
  const month = query.month ? Number(query.month) : null

  if (!campaignId || !year) {
    throw createError({
      statusCode: 400,
      message: 'campaignId and year are required',
    })
  }

  let weather: CalendarWeather[]

  if (month) {
    // Get weather for a specific month
    weather = db
      .prepare(
        `SELECT * FROM calendar_weather
         WHERE campaign_id = ? AND year = ? AND month = ?
         ORDER BY day`,
      )
      .all(campaignId, year, month) as CalendarWeather[]
  } else {
    // Get weather for entire year
    weather = db
      .prepare(
        `SELECT * FROM calendar_weather
         WHERE campaign_id = ? AND year = ?
         ORDER BY month, day`,
      )
      .all(campaignId, year) as CalendarWeather[]
  }

  return weather
})
