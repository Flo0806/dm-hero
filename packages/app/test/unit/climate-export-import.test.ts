import { describe, it, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { getTestDb } from '../utils/test-db'
import { uniqueFolderName as uniqueName } from '../../types/folder'

/**
 * Backwards-compatibility matrix for climate-zone export/import.
 *
 * The whole point (per the user): importing must NEVER break, in every combo:
 *   - new export WITH zones        → zones + profiles + per-zone weather + map circles recreated
 *   - old export WITHOUT zones      → imports exactly as before, weather stays global, no crash
 *   - name collision                → silent rename "Name (1)" (folder convention)
 *   - per-zone weather              → remapped to the new zone id; global weather stays global
 *   - map climate circles           → remapped (map + zone); skipped if zone missing
 *   - profile season remap          → by sort_order; skipped if season absent
 *
 * These mirror the import logic in `server/api/campaigns/import.post.ts` against
 * the real migrated schema, so a schema/contract drift fails the test.
 */

// ----- manifest shapes (subset of the real export manifest) -----
interface ManifestClimateZone { ref: string, name: string, color?: string | null, icon?: string | null }
interface ManifestClimateProfile { zone_ref: string, season_sort_order: number, temp_min: number, temp_max: number, weather_distribution: Record<string, number> }
interface ManifestWeather { year: number, month: number, day: number, weather_type: string, temperature?: number | null, notes?: string | null, zone_ref?: string }
interface ManifestSeason { name: string, start_month: number, start_day: number, weather_type: string | null, sort_order: number }
interface ManifestClimateArea { map: string, zone_ref: string, center_x: number, center_y: number, radius: number }
interface FakeManifest {
  seasons?: ManifestSeason[]
  climateZones?: ManifestClimateZone[]
  climateZoneSeasons?: ManifestClimateProfile[]
  weather?: ManifestWeather[]
  mapClimateAreas?: ManifestClimateArea[]
}

/**
 * Mirror of the calendar+climate import in import.post.ts. Imports a manifest's
 * climate data into `campaignId`, returns the ref→id maps for assertions.
 * `mapRefToId` simulates idMapping.maps (built when maps are imported).
 */
function importClimate(
  db: Database.Database,
  campaignId: number,
  manifest: FakeManifest,
  mapRefToId: Map<string, number> = new Map(),
) {
  const zoneRefToId = new Map<string, number>()
  const seasonSortOrderToId = new Map<number, number>()

  // Seasons (calendar overwrite recreates them; remember sort_order → id)
  if (manifest.seasons?.length) {
    const ins = db.prepare(
      'INSERT INTO calendar_seasons (campaign_id, name, start_month, start_day, weather_type, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    )
    for (const s of manifest.seasons) {
      const r = ins.run(campaignId, s.name, s.start_month, s.start_day, s.weather_type, s.sort_order)
      seasonSortOrderToId.set(s.sort_order, Number(r.lastInsertRowid))
    }
  }

  // Zones (collision → rename) + profiles
  if (manifest.climateZones?.length) {
    const insZone = db.prepare('INSERT INTO climate_zones (campaign_id, name, color, icon) VALUES (?, ?, ?, ?)')
    const existing = db.prepare('SELECT name FROM climate_zones WHERE campaign_id = ? AND deleted_at IS NULL').all(campaignId) as Array<{ name: string }>
    const taken = existing.map(r => r.name)
    for (const z of manifest.climateZones) {
      const finalName = uniqueName(taken, z.name)
      taken.push(finalName)
      const r = insZone.run(campaignId, finalName, z.color ?? null, z.icon ?? null)
      zoneRefToId.set(z.ref, Number(r.lastInsertRowid))
    }
    if (manifest.climateZoneSeasons?.length) {
      const insP = db.prepare('INSERT INTO climate_zone_seasons (zone_id, season_id, temp_min, temp_max, weather_distribution) VALUES (?, ?, ?, ?, ?)')
      for (const p of manifest.climateZoneSeasons) {
        const zoneId = zoneRefToId.get(p.zone_ref)
        const seasonId = seasonSortOrderToId.get(p.season_sort_order)
        if (!zoneId || !seasonId) continue
        insP.run(zoneId, seasonId, p.temp_min, p.temp_max, JSON.stringify(p.weather_distribution ?? {}))
      }
    }
  }

  // Weather (zone_ref → id, else global)
  if (manifest.weather?.length) {
    const insW = db.prepare('INSERT INTO calendar_weather (campaign_id, zone_id, year, month, day, weather_type, temperature, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    for (const w of manifest.weather) {
      const zoneId = w.zone_ref ? (zoneRefToId.get(w.zone_ref) ?? null) : null
      insW.run(campaignId, zoneId, w.year, w.month, w.day, w.weather_type, w.temperature ?? null, w.notes ?? null)
    }
  }

  // Map climate circles (map + zone remapped; skip if either missing)
  let mapAreasInserted = 0
  if (manifest.mapClimateAreas?.length) {
    const insC = db.prepare('INSERT INTO map_climate_areas (map_id, zone_id, center_x, center_y, radius) VALUES (?, ?, ?, ?, ?)')
    for (const a of manifest.mapClimateAreas) {
      const mapId = mapRefToId.get(a.map)
      const zoneId = zoneRefToId.get(a.zone_ref)
      if (mapId && zoneId) {
        insC.run(mapId, zoneId, a.center_x, a.center_y, a.radius)
        mapAreasInserted++
      }
    }
  }

  return { zoneRefToId, seasonSortOrderToId, mapAreasInserted }
}

describe('climate export/import backwards-compatibility', () => {
  let db: Database.Database
  let campaignId: number

  beforeEach(() => {
    db = getTestDb()
    const r = db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Target')
    campaignId = Number(r.lastInsertRowid)
  })

  it('OLD export (no climate fields, weather without zone_ref) imports cleanly as global', () => {
    const manifest: FakeManifest = {
      seasons: [{ name: 'Sommer', start_month: 6, start_day: 1, weather_type: 'summer', sort_order: 0 }],
      weather: [
        { year: 1, month: 6, day: 1, weather_type: 'sunny', temperature: 25 },
        { year: 1, month: 6, day: 2, weather_type: 'rain', temperature: 18 },
      ],
      // no climateZones, no climateZoneSeasons, no mapClimateAreas
    }
    expect(() => importClimate(db, campaignId, manifest)).not.toThrow()

    const zones = db.prepare('SELECT COUNT(*) c FROM climate_zones WHERE campaign_id = ?').get(campaignId) as { c: number }
    expect(zones.c).toBe(0)
    const weather = db.prepare('SELECT zone_id FROM calendar_weather WHERE campaign_id = ?').all(campaignId) as Array<{ zone_id: number | null }>
    expect(weather).toHaveLength(2)
    expect(weather.every(w => w.zone_id === null)).toBe(true) // all global
  })

  it('NEW export with zones recreates zones + profiles + per-zone weather', () => {
    const manifest: FakeManifest = {
      seasons: [
        { name: 'Winter', start_month: 1, start_day: 1, weather_type: 'winter', sort_order: 0 },
        { name: 'Sommer', start_month: 6, start_day: 1, weather_type: 'summer', sort_order: 1 },
      ],
      climateZones: [
        { ref: 'zone:1', name: 'Wüste', color: '#FFA726', icon: 'mdi-cactus' },
        { ref: 'zone:2', name: 'Tundra', color: '#90CAF9', icon: 'mdi-snowflake' },
      ],
      climateZoneSeasons: [
        { zone_ref: 'zone:1', season_sort_order: 1, temp_min: 30, temp_max: 45, weather_distribution: { sunny: 80, cloudy: 20 } },
        { zone_ref: 'zone:2', season_sort_order: 0, temp_min: -30, temp_max: -10, weather_distribution: { snow: 70, fog: 30 } },
      ],
      weather: [
        { year: 1, month: 6, day: 1, weather_type: 'sunny', temperature: 40, zone_ref: 'zone:1' },
        { year: 1, month: 1, day: 1, weather_type: 'snow', temperature: -20, zone_ref: 'zone:2' },
        { year: 1, month: 6, day: 1, weather_type: 'cloudy', temperature: 22 }, // global
      ],
    }
    const { zoneRefToId } = importClimate(db, campaignId, manifest)

    const zones = db.prepare('SELECT name FROM climate_zones WHERE campaign_id = ? ORDER BY name').all(campaignId) as Array<{ name: string }>
    expect(zones.map(z => z.name)).toEqual(['Tundra', 'Wüste'])

    const profiles = db.prepare('SELECT COUNT(*) c FROM climate_zone_seasons').get() as { c: number }
    expect(profiles.c).toBe(2)

    // Per-zone weather points at the right new zone id
    const desert = zoneRefToId.get('zone:1')!
    const desertWeather = db.prepare('SELECT weather_type FROM calendar_weather WHERE zone_id = ?').get(desert) as { weather_type: string }
    expect(desertWeather.weather_type).toBe('sunny')

    // Global row preserved
    const global = db.prepare('SELECT COUNT(*) c FROM calendar_weather WHERE campaign_id = ? AND zone_id IS NULL').get(campaignId) as { c: number }
    expect(global.c).toBe(1)
  })

  it('name collision → imported zone renamed "Wüste (1)"', () => {
    db.prepare('INSERT INTO climate_zones (campaign_id, name) VALUES (?, ?)').run(campaignId, 'Wüste')
    const manifest: FakeManifest = {
      climateZones: [{ ref: 'zone:1', name: 'Wüste' }],
    }
    importClimate(db, campaignId, manifest)
    const names = (db.prepare('SELECT name FROM climate_zones WHERE campaign_id = ? ORDER BY name').all(campaignId) as Array<{ name: string }>).map(r => r.name)
    expect(names).toEqual(['Wüste', 'Wüste (1)'])
  })

  it('profile whose season is absent is skipped (no crash)', () => {
    const manifest: FakeManifest = {
      seasons: [{ name: 'Sommer', start_month: 6, start_day: 1, weather_type: 'summer', sort_order: 0 }],
      climateZones: [{ ref: 'zone:1', name: 'Wüste' }],
      climateZoneSeasons: [
        { zone_ref: 'zone:1', season_sort_order: 0, temp_min: 30, temp_max: 45, weather_distribution: { sunny: 100 } },
        { zone_ref: 'zone:1', season_sort_order: 99, temp_min: 0, temp_max: 5, weather_distribution: { snow: 100 } }, // no such season
      ],
    }
    expect(() => importClimate(db, campaignId, manifest)).not.toThrow()
    const profiles = db.prepare('SELECT COUNT(*) c FROM climate_zone_seasons').get() as { c: number }
    expect(profiles.c).toBe(1) // only the season that exists
  })

  it('map climate circles remap, skip when zone missing', () => {
    const mapRes = db.prepare('INSERT INTO campaign_maps (campaign_id, name, image_url) VALUES (?, ?, ?)').run(campaignId, 'World', 'maps/x.png')
    const mapId = Number(mapRes.lastInsertRowid)
    const mapRefToId = new Map<string, number>([['map:1', mapId]])

    const manifest: FakeManifest = {
      climateZones: [{ ref: 'zone:1', name: 'Wüste' }],
      mapClimateAreas: [
        { map: 'map:1', zone_ref: 'zone:1', center_x: 30, center_y: 40, radius: 10 },
        { map: 'map:1', zone_ref: 'zone:99', center_x: 5, center_y: 5, radius: 5 }, // unknown zone → skipped
      ],
    }
    const { mapAreasInserted } = importClimate(db, campaignId, manifest, mapRefToId)
    expect(mapAreasInserted).toBe(1)
    const areas = db.prepare('SELECT center_x FROM map_climate_areas WHERE map_id = ?').all(mapId) as Array<{ center_x: number }>
    expect(areas).toHaveLength(1)
    expect(areas[0]!.center_x).toBe(30)
  })

  it('empty manifest (no calendar at all) is a clean noop', () => {
    expect(() => importClimate(db, campaignId, {})).not.toThrow()
    const zones = db.prepare('SELECT COUNT(*) c FROM climate_zones WHERE campaign_id = ?').get(campaignId) as { c: number }
    expect(zones.c).toBe(0)
  })
})
