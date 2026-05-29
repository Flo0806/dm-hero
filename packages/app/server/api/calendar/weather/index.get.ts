import { getDb } from '~~/server/utils/db'

interface CalendarWeather {
  id: number
  campaign_id: number
  zone_id: number | null
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

  // Weather is per (day, zone). A caller asks for one zone's weather:
  //   - `allZones=true`  → every row regardless of zone (for the map overview)
  //   - `zoneId` numeric → that zone's rows
  //   - `zoneId` absent  → the global rows (zone_id IS NULL; legacy / no zones)
  const allZones = query.allZones === 'true' || query.allZones === '1'
  const hasZone = query.zoneId !== undefined && query.zoneId !== '' && query.zoneId !== 'null'
  const zoneId = hasZone ? Number(query.zoneId) : null
  const zoneClause = allZones ? '' : (zoneId !== null ? 'AND zone_id = ?' : 'AND zone_id IS NULL')

  if (!campaignId || !year) {
    throw createError({
      statusCode: 400,
      message: 'campaignId and year are required',
    })
  }

  let weather: CalendarWeather[]

  const pushZone = !allZones && zoneId !== null

  if (month) {
    const params: unknown[] = [campaignId, year, month]
    if (pushZone) params.push(zoneId)
    weather = db
      .prepare(
        `SELECT * FROM calendar_weather
         WHERE campaign_id = ? AND year = ? AND month = ? ${zoneClause}
         ORDER BY day`,
      )
      .all(...params) as CalendarWeather[]
  }
  else {
    const params: unknown[] = [campaignId, year]
    if (pushZone) params.push(zoneId)
    weather = db
      .prepare(
        `SELECT * FROM calendar_weather
         WHERE campaign_id = ? AND year = ? ${zoneClause}
         ORDER BY month, day`,
      )
      .all(...params) as CalendarWeather[]
  }

  return weather
})
