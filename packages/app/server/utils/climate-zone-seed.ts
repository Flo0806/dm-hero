import type Database from 'better-sqlite3'
import { CLIMATE_ZONE_PRESETS } from '../../types/climate-zone'

interface SeasonRow {
  id: number
  weather_type: string | null
  name: string
}

/**
 * On-demand seed of the 6 default climate zones into a campaign.
 *
 * Called from the climate-zones list endpoint when the campaign has none yet.
 * Idempotent: re-running does nothing because the caller checks first.
 *
 * For each preset, we create the zone row and one profile per
 * (zone, season) where the season's `weather_type` (winter|spring|summer|autumn)
 * matches a key in the preset's `bySeasonWeatherType` map. Seasons that don't
 * map to a known weather type are silently skipped — the user can fill them in
 * via the editor later.
 *
 * If the campaign has zero calendar seasons, we still create the zones (so the
 * user sees the list) but no profiles are inserted. The generator falls back
 * to legacy behaviour until profiles exist.
 */
export function seedClimateZones(db: Database.Database, campaignId: number): void {
  const seasons = db.prepare(
    'SELECT id, weather_type, name FROM calendar_seasons WHERE campaign_id = ? ORDER BY sort_order',
  ).all(campaignId) as SeasonRow[]

  const insertZone = db.prepare(
    'INSERT INTO climate_zones (campaign_id, name, color, icon) VALUES (?, ?, ?, ?)',
  )
  const insertProfile = db.prepare(`
    INSERT INTO climate_zone_seasons (zone_id, season_id, temp_min, temp_max, weather_distribution)
    VALUES (?, ?, ?, ?, ?)
  `)

  db.exec('BEGIN')
  try {
    for (const preset of CLIMATE_ZONE_PRESETS) {
      const result = insertZone.run(campaignId, preset.name, preset.color, preset.icon)
      const zoneId = Number(result.lastInsertRowid)

      for (const season of seasons) {
        const weatherType = (season.weather_type ?? '').toLowerCase()
        if (weatherType !== 'winter' && weatherType !== 'spring' && weatherType !== 'summer' && weatherType !== 'autumn') continue
        const profile = preset.bySeasonWeatherType[weatherType]
        insertProfile.run(
          zoneId,
          season.id,
          profile.temp_min,
          profile.temp_max,
          JSON.stringify(profile.weather_distribution),
        )
      }
    }
    db.exec('COMMIT')
  }
  catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
