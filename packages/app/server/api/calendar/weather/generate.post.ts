import { getDb } from '~~/server/utils/db'
import type { WeatherDistribution } from '~~/types/climate-zone'

interface GenerateWeatherInput {
  campaignId: number
  year: number
  month: number
  overwrite?: boolean
  /** Climate zone to generate for; null/undefined = global weather (no zone) */
  zoneId?: number | null
}

interface Season {
  id: number
  name: string
  start_month: number
  start_day: number
  weather_type: string | null // 'winter' | 'spring' | 'summer' | 'autumn'
}

interface ZoneProfile {
  season_id: number
  temp_min: number
  temp_max: number
  weather_distribution: WeatherDistribution
}

// Season-based weather probabilities
const SEASON_WEATHER: Record<string, Record<string, number>> = {
  winter: {
    sunny: 10,
    partlyCloudy: 15,
    cloudy: 25,
    snow: 25,
    heavySnow: 10,
    fog: 10,
    windy: 5,
  },
  spring: {
    sunny: 20,
    partlyCloudy: 25,
    cloudy: 20,
    rain: 20,
    thunderstorm: 5,
    fog: 5,
    windy: 5,
  },
  summer: {
    sunny: 35,
    partlyCloudy: 25,
    cloudy: 15,
    rain: 10,
    thunderstorm: 10,
    windy: 5,
  },
  autumn: {
    sunny: 15,
    partlyCloudy: 20,
    cloudy: 25,
    rain: 20,
    fog: 10,
    windy: 10,
  },
}

// Temperature ranges by season (min, max)
const SEASON_TEMPS: Record<string, [number, number]> = {
  winter: [-10, 5],
  spring: [5, 18],
  summer: [18, 35],
  autumn: [5, 18],
}

function pickFromDistribution(weights: Record<string, number>): string {
  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  if (total <= 0) return 'sunny'
  let random = Math.random() * total
  for (const [type, prob] of Object.entries(weights)) {
    random -= prob
    if (random <= 0) return type
  }
  return Object.keys(weights)[0] ?? 'sunny'
}

function randomTemp(minTemp: number, maxTemp: number): number {
  return Math.round(minTemp + Math.random() * (maxTemp - minTemp))
}

/**
 * Legacy weather generator — used when no climate zone is active. Looks up
 * fixed per-season tables (`SEASON_WEATHER`/`SEASON_TEMPS`) keyed by the
 * season's `weather_type` ('winter' | 'spring' | 'summer' | 'autumn').
 */
function getRandomWeather(seasonName: string): { type: string, temp: number } {
  const normalizedSeason = seasonName.toLowerCase()
  const weatherProbs = SEASON_WEATHER[normalizedSeason] ?? SEASON_WEATHER.summer!
  const tempRange = SEASON_TEMPS[normalizedSeason] ?? SEASON_TEMPS.summer!
  return {
    type: pickFromDistribution(weatherProbs),
    temp: randomTemp(tempRange[0], tempRange[1]),
  }
}

/**
 * Zone-aware weather: uses the active climate zone's profile for the day's
 * season. Falls back to the legacy generator when no profile exists for the
 * season (e.g. user hasn't set Winter yet).
 */
function getZoneWeather(
  seasonId: number,
  seasonName: string,
  profiles: Map<number, ZoneProfile>,
): { type: string, temp: number } {
  const profile = profiles.get(seasonId)
  if (!profile) return getRandomWeather(seasonName)
  const weights = profile.weather_distribution as Record<string, number>
  if (!weights || Object.keys(weights).length === 0) {
    return getRandomWeather(seasonName)
  }
  return {
    type: pickFromDistribution(weights),
    temp: randomTemp(profile.temp_min, profile.temp_max),
  }
}

function getSeasonObjectForDay(seasons: Season[], month: number, day: number): Season | null {
  if (seasons.length === 0) return null
  const sortedSeasons = [...seasons].sort((a, b) => {
    if (a.start_month !== b.start_month) return a.start_month - b.start_month
    return a.start_day - b.start_day
  })
  let currentSeason = sortedSeasons[sortedSeasons.length - 1]!
  for (let i = 0; i < sortedSeasons.length; i++) {
    const season = sortedSeasons[i]!
    if (month > season.start_month || (month === season.start_month && day >= season.start_day)) {
      currentSeason = season
    }
  }
  return currentSeason
}

function getSeasonForDay(seasons: Season[], month: number, day: number): string {
  const currentSeason = getSeasonObjectForDay(seasons, month, day)
  if (!currentSeason) return 'summer'

  // Use explicit weather_type if set, otherwise fall back to name-based detection
  if (currentSeason.weather_type) {
    return currentSeason.weather_type
  }

  // Legacy: Normalize season name for lookup (fallback for old seasons without weather_type)
  const name = currentSeason.name.toLowerCase()
  if (name.includes('winter') || name.includes('kalt')) return 'winter'
  if (name.includes('spring') || name.includes('früh') || name.includes('lenz')) return 'spring'
  if (name.includes('summer') || name.includes('sommer')) return 'summer'
  if (name.includes('autumn') || name.includes('herbst') || name.includes('fall')) return 'autumn'

  return 'summer' // Fallback
}

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = (await readBody(event)) as GenerateWeatherInput

  const { campaignId, year, month, overwrite = false } = body
  const zoneId = body.zoneId ?? null

  if (!campaignId || !year || !month) {
    throw createError({
      statusCode: 400,
      message: 'campaignId, year, and month are required',
    })
  }

  // Get month config to know how many days
  // Note: month is 1-based from frontend, sort_order is 0-based in DB
  const monthConfig = db
    .prepare('SELECT days FROM calendar_months WHERE campaign_id = ? AND sort_order = ?')
    .get(campaignId, month - 1) as { days: number } | undefined

  if (!monthConfig) {
    throw createError({
      statusCode: 400,
      message: 'Month configuration not found',
    })
  }

  // Get seasons for this campaign
  const seasons = db
    .prepare('SELECT * FROM calendar_seasons WHERE campaign_id = ? ORDER BY start_month, start_day')
    .all(campaignId) as Season[]

  // Weather is generated PER ZONE — only for the requested zone, so generating
  // for zone A never touches zone B's (possibly hand-edited) weather.
  // zoneId null = global weather (legacy generator, no zone profile).
  if (zoneId !== null) {
    const zone = db
      .prepare('SELECT id FROM climate_zones WHERE id = ? AND campaign_id = ? AND deleted_at IS NULL')
      .get(zoneId, campaignId)
    if (!zone) {
      throw createError({ statusCode: 404, message: 'Climate zone not found' })
    }
  }

  // seasonId -> profile of the requested zone
  const zoneProfiles = new Map<number, ZoneProfile>()
  if (zoneId !== null) {
    const rows = db.prepare(`
      SELECT season_id, temp_min, temp_max, weather_distribution
      FROM climate_zone_seasons
      WHERE zone_id = ?
    `).all(zoneId) as Array<{ season_id: number, temp_min: number, temp_max: number, weather_distribution: string }>
    for (const row of rows) {
      let dist: WeatherDistribution = {}
      try {
        dist = JSON.parse(row.weather_distribution) as WeatherDistribution
      }
      catch {
        // ignore — falls back to legacy for this season
      }
      zoneProfiles.set(row.season_id, {
        season_id: row.season_id,
        temp_min: row.temp_min,
        temp_max: row.temp_max,
        weather_distribution: dist,
      })
    }
  }

  // Overwrite wipes this zone's month; otherwise we skip days that already
  // have weather in this zone.
  const zoneClause = zoneId !== null ? 'AND zone_id = ?' : 'AND zone_id IS NULL'
  const zoneParams = zoneId !== null ? [zoneId] : []
  const existing = new Set<number>()
  if (overwrite) {
    db.prepare(`DELETE FROM calendar_weather WHERE campaign_id = ? AND year = ? AND month = ? ${zoneClause}`)
      .run(campaignId, year, month, ...zoneParams)
  }
  else {
    const rows = db
      .prepare(`SELECT day FROM calendar_weather WHERE campaign_id = ? AND year = ? AND month = ? ${zoneClause}`)
      .all(campaignId, year, month, ...zoneParams) as Array<{ day: number }>
    for (const r of rows) existing.add(r.day)
  }

  const insertStmt = db.prepare(`
    INSERT INTO calendar_weather (campaign_id, zone_id, year, month, day, weather_type, temperature)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  let generated = 0
  for (let day = 1; day <= monthConfig.days; day++) {
    const seasonObj = getSeasonObjectForDay(seasons, month, day)
    const seasonName = seasonObj?.weather_type ?? getSeasonForDay(seasons, month, day)

    if (!overwrite && existing.has(day)) continue

    const { type, temp } = zoneId !== null && seasonObj && zoneProfiles.size > 0
      ? getZoneWeather(seasonObj.id, seasonName, zoneProfiles)
      : getRandomWeather(seasonName)

    insertStmt.run(campaignId, zoneId, year, month, day, type, temp)
    generated++
  }

  // Return this zone's month.
  const weather = db
    .prepare(`SELECT * FROM calendar_weather WHERE campaign_id = ? AND year = ? AND month = ? ${zoneClause} ORDER BY day`)
    .all(campaignId, year, month, ...zoneParams)

  return {
    generated,
    weather,
  }
})
