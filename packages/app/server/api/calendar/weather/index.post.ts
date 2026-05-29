import { getDb } from '~~/server/utils/db'

interface WeatherInput {
  campaignId: number
  zoneId?: number | null
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
  // Weather is per (day, zone). zoneId null = the global row.
  const zoneId = body.zoneId ?? null

  if (!campaignId || !year || !month || !day || !weatherType) {
    throw createError({
      statusCode: 400,
      message: 'campaignId, year, month, day, and weatherType are required',
    })
  }

  // Manual upsert keyed on (campaign, y, m, d, zone). We can't use ON CONFLICT
  // here because the uniqueness is enforced by two *partial* indexes (one for
  // NULL zone, one for non-null), which ON CONFLICT can't target cleanly.
  const zoneMatch = zoneId !== null ? 'zone_id = ?' : 'zone_id IS NULL'
  const lookupParams: unknown[] = [campaignId, year, month, day]
  if (zoneId !== null) lookupParams.push(zoneId)
  const existing = db
    .prepare(`SELECT id FROM calendar_weather WHERE campaign_id = ? AND year = ? AND month = ? AND day = ? AND ${zoneMatch}`)
    .get(...lookupParams) as { id: number } | undefined

  if (existing) {
    db.prepare(
      `UPDATE calendar_weather
       SET weather_type = ?, temperature = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).run(weatherType, temperature ?? null, notes ?? null, existing.id)
  }
  else {
    db.prepare(
      `INSERT INTO calendar_weather (campaign_id, zone_id, year, month, day, weather_type, temperature, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(campaignId, zoneId, year, month, day, weatherType, temperature ?? null, notes ?? null)
  }

  const weather = db
    .prepare(`SELECT * FROM calendar_weather WHERE campaign_id = ? AND year = ? AND month = ? AND day = ? AND ${zoneMatch}`)
    .get(...lookupParams)

  return weather
})
