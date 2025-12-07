import { getDb } from '~~/server/utils/db'

interface WeatherInput {
  campaignId: number
  year: number
  month: number
  day: number
  weatherType: string
  temperature?: number | null
  notes?: string | null
}

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = (await readBody(event)) as WeatherInput

  const { campaignId, year, month, day, weatherType, temperature, notes } = body

  if (!campaignId || !year || !month || !day || !weatherType) {
    throw createError({
      statusCode: 400,
      message: 'campaignId, year, month, day, and weatherType are required',
    })
  }

  // Use INSERT OR REPLACE to upsert weather data
  db.prepare(
    `INSERT INTO calendar_weather (campaign_id, year, month, day, weather_type, temperature, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(campaign_id, year, month, day)
       DO UPDATE SET
         weather_type = excluded.weather_type,
         temperature = excluded.temperature,
         notes = excluded.notes,
         updated_at = CURRENT_TIMESTAMP`,
  ).run(campaignId, year, month, day, weatherType, temperature ?? null, notes ?? null)

  const weather = db
    .prepare('SELECT * FROM calendar_weather WHERE campaign_id = ? AND year = ? AND month = ? AND day = ?')
    .get(campaignId, year, month, day)

  return weather
})
