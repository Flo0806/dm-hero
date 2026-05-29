import { describe, it, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { getTestDb } from '../utils/test-db'
import { seedClimateZones } from '../../server/utils/climate-zone-seed'
import { normaliseDistribution, CLIMATE_ZONE_PRESETS } from '../../types/climate-zone'

/**
 * Core climate-zone invariants:
 *  - calendar_weather partial unique indexes (migration 52): exactly one global
 *    row per day, one row per (day, zone), different zones coexist
 *  - seedClimateZones: 6 presets + profiles for matching seasons only
 *  - normaliseDistribution: weights → ~100, drops non-positive
 */

describe('calendar_weather per-zone uniqueness (migration 52)', () => {
  let db: Database.Database
  let campaignId: number

  beforeEach(() => {
    db = getTestDb()
    campaignId = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('W').lastInsertRowid)
  })

  function insertWeather(zoneId: number | null) {
    return db
      .prepare('INSERT INTO calendar_weather (campaign_id, zone_id, year, month, day, weather_type, temperature) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(campaignId, zoneId, 1, 1, 1, 'sunny', 20)
  }

  function makeZone() {
    return Number(db.prepare('INSERT INTO climate_zones (campaign_id, name) VALUES (?, ?)').run(campaignId, `Z${Math.random()}`).lastInsertRowid)
  }

  it('allows one global weather per day, rejects a second', () => {
    insertWeather(null)
    expect(() => insertWeather(null)).toThrow() // UNIQUE (partial, zone_id IS NULL)
  })

  it('allows one weather per (day, zone), rejects a second for the same zone', () => {
    const zone = makeZone()
    insertWeather(zone)
    expect(() => insertWeather(zone)).toThrow()
  })

  it('lets a global row and a per-zone row coexist on the same day', () => {
    const zone = makeZone()
    insertWeather(null)
    expect(() => insertWeather(zone)).not.toThrow()
    const rows = db.prepare('SELECT COUNT(*) c FROM calendar_weather WHERE campaign_id = ?').get(campaignId) as { c: number }
    expect(rows.c).toBe(2)
  })

  it('lets two different zones have weather on the same day', () => {
    const a = makeZone()
    const b = makeZone()
    insertWeather(a)
    expect(() => insertWeather(b)).not.toThrow()
  })

  it('deleting a zone cascades its weather (FK ON DELETE CASCADE)', () => {
    const zone = makeZone()
    insertWeather(zone)
    db.prepare('DELETE FROM climate_zones WHERE id = ?').run(zone)
    const rows = db.prepare('SELECT COUNT(*) c FROM calendar_weather WHERE zone_id = ?').get(zone) as { c: number }
    expect(rows.c).toBe(0)
  })
})

describe('seedClimateZones', () => {
  let db: Database.Database
  let campaignId: number

  beforeEach(() => {
    db = getTestDb()
    campaignId = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Seed').lastInsertRowid)
  })

  it('seeds all presets with profiles for the matching seasons', () => {
    // Two seasons that map to preset weather types, one that doesn't.
    db.prepare('INSERT INTO calendar_seasons (campaign_id, name, start_month, start_day, weather_type, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
      .run(campaignId, 'Winter', 1, 1, 'winter', 0)
    db.prepare('INSERT INTO calendar_seasons (campaign_id, name, start_month, start_day, weather_type, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
      .run(campaignId, 'Sommer', 6, 1, 'summer', 1)
    db.prepare('INSERT INTO calendar_seasons (campaign_id, name, start_month, start_day, weather_type, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
      .run(campaignId, 'Regenzeit', 9, 1, 'monsoon', 2) // not a known weather type

    seedClimateZones(db, campaignId)

    const zones = db.prepare('SELECT COUNT(*) c FROM climate_zones WHERE campaign_id = ?').get(campaignId) as { c: number }
    expect(zones.c).toBe(CLIMATE_ZONE_PRESETS.length)

    // Each zone gets a profile for the 2 matching seasons, not the unknown one.
    const profiles = db.prepare(`
      SELECT COUNT(*) c FROM climate_zone_seasons czs
      JOIN climate_zones cz ON cz.id = czs.zone_id WHERE cz.campaign_id = ?
    `).get(campaignId) as { c: number }
    expect(profiles.c).toBe(CLIMATE_ZONE_PRESETS.length * 2)
  })

  it('still seeds zones when the campaign has no seasons (just no profiles)', () => {
    seedClimateZones(db, campaignId)
    const zones = db.prepare('SELECT COUNT(*) c FROM climate_zones WHERE campaign_id = ?').get(campaignId) as { c: number }
    expect(zones.c).toBe(CLIMATE_ZONE_PRESETS.length)
    const profiles = db.prepare('SELECT COUNT(*) c FROM climate_zone_seasons').get() as { c: number }
    expect(profiles.c).toBe(0)
  })
})

describe('normaliseDistribution', () => {
  it('scales weights to sum ~100', () => {
    const out = normaliseDistribution({ sunny: 1, rain: 1 })
    expect(out.sunny).toBe(50)
    expect(out.rain).toBe(50)
  })

  it('drops zero / negative weights', () => {
    const out = normaliseDistribution({ sunny: 10, rain: 0, snow: -5 })
    expect(out.sunny).toBe(100)
    expect(out.rain).toBeUndefined()
    expect(out.snow).toBeUndefined()
  })

  it('returns the input unchanged when total is zero', () => {
    const out = normaliseDistribution({ sunny: 0 })
    expect(out).toEqual({ sunny: 0 })
  })
})
