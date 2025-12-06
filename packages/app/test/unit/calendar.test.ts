import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

// Calendar Database Tests
// Tests the calendar configuration tables and queries

let db: Database.Database
let testCampaignId: number

beforeAll(() => {
  db = getDb()

  // Create test campaign
  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign Calendar', 'Test description')
  testCampaignId = Number(campaign.lastInsertRowid)
})

afterAll(() => {
  if (db) {
    // Clean up in correct order
    db.prepare('DELETE FROM calendar_moons WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM calendar_weekdays WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM calendar_months WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM calendar_config WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(testCampaignId)
  }
})

beforeEach(() => {
  // Clean up calendar data before each test
  db.prepare('DELETE FROM calendar_moons WHERE campaign_id = ?').run(testCampaignId)
  db.prepare('DELETE FROM calendar_weekdays WHERE campaign_id = ?').run(testCampaignId)
  db.prepare('DELETE FROM calendar_months WHERE campaign_id = ?').run(testCampaignId)
  db.prepare('DELETE FROM calendar_config WHERE campaign_id = ?').run(testCampaignId)
})

describe('Calendar Config', () => {
  it('should create calendar config for a campaign', () => {
    const result = db
      .prepare(`
        INSERT INTO calendar_config (
          campaign_id, current_year, current_month, current_day,
          year_zero_name, era_name, leap_year_interval, leap_year_month, leap_year_extra_days
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(testCampaignId, 1352, 3, 15, 'Before the Reckoning', 'DR', 4, 2, 1)

    expect(result.changes).toBe(1)

    const config = db
      .prepare('SELECT * FROM calendar_config WHERE campaign_id = ?')
      .get(testCampaignId) as {
        current_year: number
        current_month: number
        current_day: number
        era_name: string
      }

    expect(config.current_year).toBe(1352)
    expect(config.current_month).toBe(3)
    expect(config.current_day).toBe(15)
    expect(config.era_name).toBe('DR')
  })

  it('should update current date', () => {
    db.prepare(`
      INSERT INTO calendar_config (campaign_id, current_year, current_month, current_day)
      VALUES (?, ?, ?, ?)
    `).run(testCampaignId, 1352, 1, 1)

    db.prepare(`
      UPDATE calendar_config
      SET current_year = ?, current_month = ?, current_day = ?
      WHERE campaign_id = ?
    `).run(1353, 6, 20, testCampaignId)

    const config = db
      .prepare('SELECT current_year, current_month, current_day FROM calendar_config WHERE campaign_id = ?')
      .get(testCampaignId) as { current_year: number; current_month: number; current_day: number }

    expect(config.current_year).toBe(1353)
    expect(config.current_month).toBe(6)
    expect(config.current_day).toBe(20)
  })
})

describe('Calendar Months', () => {
  it('should create calendar months', () => {
    const months = [
      { name: 'Hammer', days: 30 },
      { name: 'Alturiak', days: 30 },
      { name: 'Ches', days: 30 },
      { name: 'Tarsakh', days: 30 },
    ]

    months.forEach((month, index) => {
      db.prepare(`
        INSERT INTO calendar_months (campaign_id, name, days, sort_order)
        VALUES (?, ?, ?, ?)
      `).run(testCampaignId, month.name, month.days, index + 1)
    })

    const storedMonths = db
      .prepare('SELECT * FROM calendar_months WHERE campaign_id = ? ORDER BY sort_order')
      .all(testCampaignId) as Array<{ name: string; days: number; sort_order: number }>

    expect(storedMonths).toHaveLength(4)
    expect(storedMonths[0].name).toBe('Hammer')
    expect(storedMonths[0].days).toBe(30)
    expect(storedMonths[0].sort_order).toBe(1)
  })

  it('should calculate total days in a year', () => {
    // Create 12 months with 30 days each
    for (let i = 1; i <= 12; i++) {
      db.prepare(`
        INSERT INTO calendar_months (campaign_id, name, days, sort_order)
        VALUES (?, ?, ?, ?)
      `).run(testCampaignId, `Month ${i}`, 30, i)
    }

    const totalDays = db
      .prepare('SELECT SUM(days) as total FROM calendar_months WHERE campaign_id = ?')
      .get(testCampaignId) as { total: number }

    expect(totalDays.total).toBe(360) // 12 * 30
  })
})

describe('Calendar Weekdays', () => {
  it('should create calendar weekdays', () => {
    const weekdays = ['Moonday', 'Towerday', 'Waterday', 'Thunderday', 'Freeday', 'Starday', 'Sunday']

    weekdays.forEach((day, index) => {
      db.prepare(`
        INSERT INTO calendar_weekdays (campaign_id, name, sort_order)
        VALUES (?, ?, ?)
      `).run(testCampaignId, day, index + 1)
    })

    const storedDays = db
      .prepare('SELECT * FROM calendar_weekdays WHERE campaign_id = ? ORDER BY sort_order')
      .all(testCampaignId) as Array<{ name: string; sort_order: number }>

    expect(storedDays).toHaveLength(7)
    expect(storedDays[0].name).toBe('Moonday')
    expect(storedDays[6].name).toBe('Sunday')
  })
})

describe('Calendar Moons', () => {
  it('should create calendar moons', () => {
    db.prepare(`
      INSERT INTO calendar_moons (
        campaign_id, name, cycle_days, full_moon_duration, new_moon_duration, phase_offset
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(testCampaignId, 'Selûne', 30, 3, 3, 0)

    const moon = db
      .prepare('SELECT * FROM calendar_moons WHERE campaign_id = ?')
      .get(testCampaignId) as {
        name: string
        cycle_days: number
        full_moon_duration: number
        new_moon_duration: number
      }

    expect(moon.name).toBe('Selûne')
    expect(moon.cycle_days).toBe(30)
    expect(moon.full_moon_duration).toBe(3)
    expect(moon.new_moon_duration).toBe(3)
  })

  it('should support multiple moons', () => {
    db.prepare(`
      INSERT INTO calendar_moons (campaign_id, name, cycle_days, full_moon_duration, new_moon_duration, phase_offset)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(testCampaignId, 'Moon 1', 28, 2, 2, 0)

    db.prepare(`
      INSERT INTO calendar_moons (campaign_id, name, cycle_days, full_moon_duration, new_moon_duration, phase_offset)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(testCampaignId, 'Moon 2', 35, 4, 4, 7)

    const moons = db
      .prepare('SELECT * FROM calendar_moons WHERE campaign_id = ?')
      .all(testCampaignId) as Array<{ name: string }>

    expect(moons).toHaveLength(2)
  })
})

describe('Calendar - Leap Year Configuration', () => {
  it('should store leap year settings', () => {
    db.prepare(`
      INSERT INTO calendar_config (
        campaign_id, current_year, current_month, current_day,
        leap_year_interval, leap_year_month, leap_year_extra_days
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(testCampaignId, 1352, 1, 1, 4, 2, 1)

    const config = db
      .prepare('SELECT leap_year_interval, leap_year_month, leap_year_extra_days FROM calendar_config WHERE campaign_id = ?')
      .get(testCampaignId) as {
        leap_year_interval: number
        leap_year_month: number
        leap_year_extra_days: number
      }

    expect(config.leap_year_interval).toBe(4)
    expect(config.leap_year_month).toBe(2) // Extra day added to month 2
    expect(config.leap_year_extra_days).toBe(1)
  })
})

describe('Calendar - Campaign Isolation', () => {
  it('should only return calendar data for the active campaign', () => {
    // Create another campaign
    const campaign2 = db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Campaign 2')
    const campaign2Id = Number(campaign2.lastInsertRowid)

    // Create config for both campaigns
    db.prepare(`
      INSERT INTO calendar_config (campaign_id, current_year, current_month, current_day)
      VALUES (?, ?, ?, ?)
    `).run(testCampaignId, 1000, 1, 1)

    db.prepare(`
      INSERT INTO calendar_config (campaign_id, current_year, current_month, current_day)
      VALUES (?, ?, ?, ?)
    `).run(campaign2Id, 2000, 1, 1)

    // Query each campaign's config
    const config1 = db
      .prepare('SELECT current_year FROM calendar_config WHERE campaign_id = ?')
      .get(testCampaignId) as { current_year: number }

    const config2 = db
      .prepare('SELECT current_year FROM calendar_config WHERE campaign_id = ?')
      .get(campaign2Id) as { current_year: number }

    expect(config1.current_year).toBe(1000)
    expect(config2.current_year).toBe(2000)

    // Cleanup
    db.prepare('DELETE FROM calendar_config WHERE campaign_id = ?').run(campaign2Id)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(campaign2Id)
  })
})

describe('Calendar - Date Calculation Logic', () => {
  // Pure function tests for calendar math (without Vue composable)

  it('should calculate days in year correctly', () => {
    // Setup: 12 months with 30 days each = 360 days/year
    for (let i = 1; i <= 12; i++) {
      db.prepare(`
        INSERT INTO calendar_months (campaign_id, name, days, sort_order)
        VALUES (?, ?, ?, ?)
      `).run(testCampaignId, `Month ${i}`, 30, i)
    }

    const months = db
      .prepare('SELECT SUM(days) as total FROM calendar_months WHERE campaign_id = ?')
      .get(testCampaignId) as { total: number }

    expect(months.total).toBe(360)
  })

  it('should handle different month lengths', () => {
    // Setup months with varying lengths (like Forgotten Realms)
    const monthLengths = [30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 5] // 365 days with 5-day festival

    monthLengths.forEach((days, index) => {
      db.prepare(`
        INSERT INTO calendar_months (campaign_id, name, days, sort_order)
        VALUES (?, ?, ?, ?)
      `).run(testCampaignId, `Month ${index + 1}`, days, index + 1)
    })

    const total = db
      .prepare('SELECT SUM(days) as total FROM calendar_months WHERE campaign_id = ?')
      .get(testCampaignId) as { total: number }

    expect(total.total).toBe(365)
  })
})
