import { getDb } from '../../../../utils/db'
import { createApiError, ErrorCodes } from '../../../../utils/errors'
import { CLIMATE_ZONE_PRESETS, type ClimateZone } from '../../../../../types/climate-zone'

interface CreateBody {
  name?: string
  color?: string | null
  icon?: string | null
  /** Name of a preset to clone profiles from (optional). */
  cloneFromPreset?: string
}

export default defineEventHandler(async (event): Promise<ClimateZone> => {
  const campaignId = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(campaignId) || campaignId <= 0) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.CAMPAIGN_ID_REQUIRED })
  }
  const body = await readBody<CreateBody>(event)
  const name = (body?.name ?? '').trim()
  if (!name) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'name required' })
  }

  const db = getDb()
  const preset = body?.cloneFromPreset
    ? CLIMATE_ZONE_PRESETS.find(p => p.name === body.cloneFromPreset)
    : undefined

  db.exec('BEGIN')
  try {
    const result = db.prepare(
      'INSERT INTO climate_zones (campaign_id, name, color, icon) VALUES (?, ?, ?, ?)',
    ).run(
      campaignId,
      name,
      body?.color ?? preset?.color ?? null,
      body?.icon ?? preset?.icon ?? null,
    )
    const zoneId = Number(result.lastInsertRowid)

    // If cloning a preset, pre-fill profiles for each matching season.
    if (preset) {
      const seasons = db.prepare(
        'SELECT id, weather_type FROM calendar_seasons WHERE campaign_id = ?',
      ).all(campaignId) as Array<{ id: number, weather_type: string | null }>
      const insertProfile = db.prepare(`
        INSERT INTO climate_zone_seasons (zone_id, season_id, temp_min, temp_max, weather_distribution)
        VALUES (?, ?, ?, ?, ?)
      `)
      for (const season of seasons) {
        const weatherType = (season.weather_type ?? '').toLowerCase()
        if (weatherType !== 'winter' && weatherType !== 'spring' && weatherType !== 'summer' && weatherType !== 'autumn') continue
        const profile = preset.bySeasonWeatherType[weatherType]
        insertProfile.run(zoneId, season.id, profile.temp_min, profile.temp_max, JSON.stringify(profile.weather_distribution))
      }
    }

    db.exec('COMMIT')
    return db.prepare('SELECT * FROM climate_zones WHERE id = ?').get(zoneId) as ClimateZone
  }
  catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
})
