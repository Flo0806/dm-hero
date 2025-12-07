import { getDb } from '~~/server/utils/db'

interface GenerateWeatherInput {
  campaignId: number
  year: number
  month: number
  overwrite?: boolean
}

interface Season {
  id: number
  name: string
  start_month: number
  start_day: number
  weather_type: string | null // 'winter' | 'spring' | 'summer' | 'autumn'
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

function getRandomWeather(seasonName: string): { type: string; temp: number } {
  const normalizedSeason = seasonName.toLowerCase()
  const weatherProbs = SEASON_WEATHER[normalizedSeason] || SEASON_WEATHER.summer
  const tempRange = SEASON_TEMPS[normalizedSeason] || SEASON_TEMPS.summer

  // Weighted random selection
  const total = Object.values(weatherProbs).reduce((a, b) => a + b, 0)
  let random = Math.random() * total

  let weatherType = 'sunny'
  for (const [type, prob] of Object.entries(weatherProbs)) {
    random -= prob
    if (random <= 0) {
      weatherType = type
      break
    }
  }

  // Random temperature within range with some variance
  const [minTemp, maxTemp] = tempRange
  const temp = Math.round(minTemp + Math.random() * (maxTemp - minTemp))

  return { type: weatherType, temp }
}

function getSeasonForDay(seasons: Season[], month: number, day: number): string {
  if (seasons.length === 0) return 'summer'

  // Sort seasons by start date
  const sortedSeasons = [...seasons].sort((a, b) => {
    if (a.start_month !== b.start_month) return a.start_month - b.start_month
    return a.start_day - b.start_day
  })

  // Find which season the day falls into
  let currentSeason = sortedSeasons[sortedSeasons.length - 1] // Default to last season (wraps around)

  for (let i = 0; i < sortedSeasons.length; i++) {
    const season = sortedSeasons[i]
    if (month > season.start_month || (month === season.start_month && day >= season.start_day)) {
      currentSeason = season
    }
  }

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

  // Get existing weather if not overwriting
  const existingWeather = new Set<number>()
  if (!overwrite) {
    const existing = db
      .prepare('SELECT day FROM calendar_weather WHERE campaign_id = ? AND year = ? AND month = ?')
      .all(campaignId, year, month) as Array<{ day: number }>
    existing.forEach((w) => existingWeather.add(w.day))
  } else {
    // Delete existing weather for this month
    db.prepare('DELETE FROM calendar_weather WHERE campaign_id = ? AND year = ? AND month = ?').run(
      campaignId,
      year,
      month,
    )
  }

  // Generate weather for each day
  const insertStmt = db.prepare(`
    INSERT INTO calendar_weather (campaign_id, year, month, day, weather_type, temperature)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  let generated = 0
  for (let day = 1; day <= monthConfig.days; day++) {
    if (!overwrite && existingWeather.has(day)) {
      continue
    }

    const seasonName = getSeasonForDay(seasons, month, day)
    const { type, temp } = getRandomWeather(seasonName)

    insertStmt.run(campaignId, year, month, day, type, temp)
    generated++
  }

  // Return the generated weather
  const weather = db
    .prepare('SELECT * FROM calendar_weather WHERE campaign_id = ? AND year = ? AND month = ? ORDER BY day')
    .all(campaignId, year, month)

  return {
    generated,
    weather,
  }
})
