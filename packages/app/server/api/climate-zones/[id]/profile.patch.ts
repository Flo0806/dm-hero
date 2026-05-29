import { getDb } from '../../../utils/db'
import { createApiError, ErrorCodes } from '../../../utils/errors'
import type { ClimateZoneSeason, WeatherDistribution } from '../../../../types/climate-zone'
import { WEATHER_TYPES } from '../../../../types/climate-zone'

interface UpsertBody {
  season_id?: number
  temp_min?: number
  temp_max?: number
  weather_distribution?: WeatherDistribution
}

/**
 * Upsert a (zone, season) profile. POST/PATCH semantics merged into a single
 * PATCH because the season is the natural key — there's at most one row per
 * (zone_id, season_id).
 */
export default defineEventHandler(async (event): Promise<ClimateZoneSeason> => {
  const zoneId = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(zoneId)) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'invalid zone id' })
  }
  const body = await readBody<UpsertBody>(event)
  const seasonId = Number(body?.season_id)
  if (!Number.isFinite(seasonId) || seasonId <= 0) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'season_id required' })
  }
  const tempMin = Number(body?.temp_min)
  const tempMax = Number(body?.temp_max)
  if (!Number.isFinite(tempMin) || !Number.isFinite(tempMax)) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'temp_min/max required' })
  }
  // max must be strictly greater than min — never equal, never less.
  if (tempMax <= tempMin) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'temp_max must be greater than temp_min' })
  }

  // Whitelist the distribution keys so a client can't sneak in arbitrary
  // weather names that the generator doesn't know about.
  const dist: WeatherDistribution = {}
  if (body?.weather_distribution) {
    for (const key of WEATHER_TYPES) {
      const w = body.weather_distribution[key]
      if (typeof w === 'number' && w > 0) dist[key] = Math.round(w)
    }
  }

  const db = getDb()
  const zone = db.prepare(
    'SELECT id, campaign_id FROM climate_zones WHERE id = ? AND deleted_at IS NULL',
  ).get(zoneId) as { id: number, campaign_id: number } | undefined
  if (!zone) {
    throw createApiError({ statusCode: 404, code: ErrorCodes.NOT_FOUND, message: 'zone not found' })
  }
  // Season must belong to the same campaign so callers can't graft a profile
  // onto a season from a different campaign.
  const season = db.prepare(
    'SELECT id FROM calendar_seasons WHERE id = ? AND campaign_id = ?',
  ).get(seasonId, zone.campaign_id) as { id: number } | undefined
  if (!season) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'season not in this campaign' })
  }

  const distJson = JSON.stringify(dist)
  db.prepare(`
    INSERT INTO climate_zone_seasons (zone_id, season_id, temp_min, temp_max, weather_distribution)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(zone_id, season_id) DO UPDATE SET
      temp_min = excluded.temp_min,
      temp_max = excluded.temp_max,
      weather_distribution = excluded.weather_distribution,
      updated_at = datetime('now')
  `).run(zoneId, seasonId, tempMin, tempMax, distJson)

  const row = db.prepare(
    'SELECT * FROM climate_zone_seasons WHERE zone_id = ? AND season_id = ?',
  ).get(zoneId, seasonId) as {
    id: number
    zone_id: number
    season_id: number
    temp_min: number
    temp_max: number
    weather_distribution: string
    created_at: string
    updated_at: string
  }
  return {
    ...row,
    weather_distribution: JSON.parse(row.weather_distribution) as WeatherDistribution,
  }
})
