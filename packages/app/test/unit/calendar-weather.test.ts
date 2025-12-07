import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

// Calendar Weather Tests
// Tests weather generation and storage for calendar days

interface CalendarWeather {
  id: number
  campaign_id: number
  year: number
  month: number
  day: number
  weather_type: string
  temperature: number | null
  notes: string | null
}

interface CalendarSeason {
  id: number
  campaign_id: number
  name: string
  start_month: number
  start_day: number
  weather_type: string | null
}

let db: Database.Database
let testCampaignId: number

beforeAll(() => {
  db = getDb()

  // Create test campaign
  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign Weather', 'Test description')
  testCampaignId = Number(campaign.lastInsertRowid)

  // Create calendar config
  db.prepare(`
    INSERT INTO calendar_config (campaign_id, current_year, current_month, current_day)
    VALUES (?, ?, ?, ?)
  `).run(testCampaignId, 1352, 1, 1)

  // Create months
  for (let i = 0; i < 12; i++) {
    db.prepare(`
      INSERT INTO calendar_months (campaign_id, name, days, sort_order)
      VALUES (?, ?, ?, ?)
    `).run(testCampaignId, `Month ${i + 1}`, 30, i)
  }
})

afterAll(() => {
  if (db) {
    // Clean up in correct order
    db.prepare('DELETE FROM calendar_weather WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM calendar_seasons WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM calendar_months WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM calendar_config WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(testCampaignId)
  }
})

beforeEach(() => {
  // Clean up weather and seasons before each test
  db.prepare('DELETE FROM calendar_weather WHERE campaign_id = ?').run(testCampaignId)
  db.prepare('DELETE FROM calendar_seasons WHERE campaign_id = ?').run(testCampaignId)
})

describe('Calendar Weather - Basic CRUD', () => {
  it('should store weather data for a specific day', () => {
    const result = db
      .prepare(`
        INSERT INTO calendar_weather (campaign_id, year, month, day, weather_type, temperature, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(testCampaignId, 1352, 3, 15, 'sunny', 22, 'Clear spring day')

    expect(result.changes).toBe(1)

    const weather = db
      .prepare('SELECT * FROM calendar_weather WHERE campaign_id = ? AND year = ? AND month = ? AND day = ?')
      .get(testCampaignId, 1352, 3, 15) as CalendarWeather

    expect(weather.weather_type).toBe('sunny')
    expect(weather.temperature).toBe(22)
    expect(weather.notes).toBe('Clear spring day')
  })

  it('should update existing weather data on conflict', () => {
    // Insert initial weather
    db.prepare(`
      INSERT INTO calendar_weather (campaign_id, year, month, day, weather_type, temperature)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(testCampaignId, 1352, 5, 10, 'sunny', 25)

    // Upsert with new data
    db.prepare(`
      INSERT INTO calendar_weather (campaign_id, year, month, day, weather_type, temperature, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(campaign_id, year, month, day)
      DO UPDATE SET
        weather_type = excluded.weather_type,
        temperature = excluded.temperature,
        notes = excluded.notes
    `).run(testCampaignId, 1352, 5, 10, 'rain', 18, 'Unexpected storm')

    const weather = db
      .prepare('SELECT * FROM calendar_weather WHERE campaign_id = ? AND year = ? AND month = ? AND day = ?')
      .get(testCampaignId, 1352, 5, 10) as CalendarWeather

    expect(weather.weather_type).toBe('rain')
    expect(weather.temperature).toBe(18)
    expect(weather.notes).toBe('Unexpected storm')
  })

  it('should delete weather data', () => {
    // Insert weather
    const insert = db
      .prepare(`
        INSERT INTO calendar_weather (campaign_id, year, month, day, weather_type, temperature)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(testCampaignId, 1352, 7, 20, 'thunderstorm', 28)

    const weatherId = Number(insert.lastInsertRowid)

    // Delete
    db.prepare('DELETE FROM calendar_weather WHERE id = ?').run(weatherId)

    const weather = db
      .prepare('SELECT * FROM calendar_weather WHERE id = ?')
      .get(weatherId)

    expect(weather).toBeUndefined()
  })

  it('should query weather for entire month', () => {
    // Insert weather for multiple days
    for (let day = 1; day <= 5; day++) {
      db.prepare(`
        INSERT INTO calendar_weather (campaign_id, year, month, day, weather_type, temperature)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(testCampaignId, 1352, 6, day, day % 2 === 0 ? 'cloudy' : 'sunny', 20 + day)
    }

    const weatherData = db
      .prepare('SELECT * FROM calendar_weather WHERE campaign_id = ? AND year = ? AND month = ? ORDER BY day')
      .all(testCampaignId, 1352, 6) as CalendarWeather[]

    expect(weatherData).toHaveLength(5)
    expect(weatherData[0].weather_type).toBe('sunny')
    expect(weatherData[1].weather_type).toBe('cloudy')
  })
})

describe('Calendar Weather - Weather Types', () => {
  const weatherTypes = [
    'sunny',
    'partlyCloudy',
    'cloudy',
    'rain',
    'heavyRain',
    'thunderstorm',
    'snow',
    'heavySnow',
    'fog',
    'windy',
    'hail',
  ]

  it('should accept all valid weather types', () => {
    weatherTypes.forEach((type, index) => {
      db.prepare(`
        INSERT INTO calendar_weather (campaign_id, year, month, day, weather_type, temperature)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(testCampaignId, 1352, 1, index + 1, type, 15)
    })

    const allWeather = db
      .prepare('SELECT weather_type FROM calendar_weather WHERE campaign_id = ? AND year = ? AND month = ? ORDER BY day')
      .all(testCampaignId, 1352, 1) as Array<{ weather_type: string }>

    expect(allWeather).toHaveLength(weatherTypes.length)
    allWeather.forEach((w, i) => {
      expect(w.weather_type).toBe(weatherTypes[i])
    })
  })
})

describe('Calendar Seasons - Weather Type Field', () => {
  it('should create season with explicit weather_type', () => {
    const result = db
      .prepare(`
        INSERT INTO calendar_seasons (campaign_id, name, start_month, start_day, weather_type)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(testCampaignId, 'Kalter Sturm', 12, 1, 'winter')

    expect(result.changes).toBe(1)

    const season = db
      .prepare('SELECT * FROM calendar_seasons WHERE campaign_id = ?')
      .get(testCampaignId) as CalendarSeason

    expect(season.name).toBe('Kalter Sturm')
    expect(season.weather_type).toBe('winter')
  })

  it('should update season weather_type', () => {
    // Create season without weather_type
    const insert = db
      .prepare(`
        INSERT INTO calendar_seasons (campaign_id, name, start_month, start_day)
        VALUES (?, ?, ?, ?)
      `)
      .run(testCampaignId, 'Frühlingserwachen', 3, 1)

    const seasonId = Number(insert.lastInsertRowid)

    // Update weather_type
    db.prepare('UPDATE calendar_seasons SET weather_type = ? WHERE id = ?').run('spring', seasonId)

    const season = db
      .prepare('SELECT * FROM calendar_seasons WHERE id = ?')
      .get(seasonId) as CalendarSeason

    expect(season.weather_type).toBe('spring')
  })

  it('should support all four season weather types', () => {
    const seasons = [
      { name: 'Winter', month: 12, weatherType: 'winter' },
      { name: 'Frühling', month: 3, weatherType: 'spring' },
      { name: 'Sommer', month: 6, weatherType: 'summer' },
      { name: 'Herbst', month: 9, weatherType: 'autumn' },
    ]

    seasons.forEach((s) => {
      db.prepare(`
        INSERT INTO calendar_seasons (campaign_id, name, start_month, start_day, weather_type)
        VALUES (?, ?, ?, ?, ?)
      `).run(testCampaignId, s.name, s.month, 1, s.weatherType)
    })

    const storedSeasons = db
      .prepare('SELECT * FROM calendar_seasons WHERE campaign_id = ? ORDER BY start_month')
      .all(testCampaignId) as CalendarSeason[]

    expect(storedSeasons).toHaveLength(4)
    expect(storedSeasons.map((s) => s.weather_type)).toEqual(['spring', 'summer', 'autumn', 'winter'])
  })
})

describe('Calendar Weather - Campaign Isolation', () => {
  it('should only return weather for the active campaign', () => {
    // Create another campaign
    const campaign2 = db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Campaign 2 Weather')
    const campaign2Id = Number(campaign2.lastInsertRowid)

    // Create weather for both campaigns
    db.prepare(`
      INSERT INTO calendar_weather (campaign_id, year, month, day, weather_type, temperature)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(testCampaignId, 1352, 1, 1, 'sunny', 20)

    db.prepare(`
      INSERT INTO calendar_weather (campaign_id, year, month, day, weather_type, temperature)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(campaign2Id, 1352, 1, 1, 'snow', -5)

    // Query each campaign's weather
    const weather1 = db
      .prepare('SELECT weather_type, temperature FROM calendar_weather WHERE campaign_id = ? AND year = ? AND month = ? AND day = ?')
      .get(testCampaignId, 1352, 1, 1) as { weather_type: string; temperature: number }

    const weather2 = db
      .prepare('SELECT weather_type, temperature FROM calendar_weather WHERE campaign_id = ? AND year = ? AND month = ? AND day = ?')
      .get(campaign2Id, 1352, 1, 1) as { weather_type: string; temperature: number }

    expect(weather1.weather_type).toBe('sunny')
    expect(weather1.temperature).toBe(20)
    expect(weather2.weather_type).toBe('snow')
    expect(weather2.temperature).toBe(-5)

    // Cleanup
    db.prepare('DELETE FROM calendar_weather WHERE campaign_id = ?').run(campaign2Id)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(campaign2Id)
  })
})

describe('Calendar Weather - Temperature Ranges', () => {
  it('should store negative temperatures', () => {
    db.prepare(`
      INSERT INTO calendar_weather (campaign_id, year, month, day, weather_type, temperature)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(testCampaignId, 1352, 1, 15, 'snow', -15)

    const weather = db
      .prepare('SELECT temperature FROM calendar_weather WHERE campaign_id = ? AND year = ? AND month = ? AND day = ?')
      .get(testCampaignId, 1352, 1, 15) as { temperature: number }

    expect(weather.temperature).toBe(-15)
  })

  it('should store high temperatures', () => {
    db.prepare(`
      INSERT INTO calendar_weather (campaign_id, year, month, day, weather_type, temperature)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(testCampaignId, 1352, 7, 15, 'sunny', 40)

    const weather = db
      .prepare('SELECT temperature FROM calendar_weather WHERE campaign_id = ? AND year = ? AND month = ? AND day = ?')
      .get(testCampaignId, 1352, 7, 15) as { temperature: number }

    expect(weather.temperature).toBe(40)
  })

  it('should allow null temperature', () => {
    db.prepare(`
      INSERT INTO calendar_weather (campaign_id, year, month, day, weather_type, temperature)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(testCampaignId, 1352, 4, 1, 'cloudy', null)

    const weather = db
      .prepare('SELECT temperature FROM calendar_weather WHERE campaign_id = ? AND year = ? AND month = ? AND day = ?')
      .get(testCampaignId, 1352, 4, 1) as { temperature: number | null }

    expect(weather.temperature).toBeNull()
  })
})
