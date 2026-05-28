import { getDb } from '../../../../utils/db'
import { createApiError, ErrorCodes } from '../../../../utils/errors'
import { seedClimateZones } from '../../../../utils/climate-zone-seed'
import type { ClimateZoneWithProfiles, WeatherDistribution } from '../../../../../types/climate-zone'

interface ZoneRow {
  id: number
  campaign_id: number
  name: string
  color: string | null
  icon: string | null
  created_at: string
  updated_at: string
}

interface ProfileRow {
  id: number
  zone_id: number
  season_id: number
  temp_min: number
  temp_max: number
  weather_distribution: string
  created_at: string
  updated_at: string
}

export default defineEventHandler((event): ClimateZoneWithProfiles[] => {
  const campaignId = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(campaignId) || campaignId <= 0) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.CAMPAIGN_ID_REQUIRED })
  }

  const db = getDb()

  // Auto-seed on first read for this campaign — falls in line with the user
  // spec ("seed on first open of Zone-Settings"). Subsequent reads see the
  // already-seeded rows and skip.
  const existing = db.prepare(
    'SELECT COUNT(*) AS c FROM climate_zones WHERE campaign_id = ? AND deleted_at IS NULL',
  ).get(campaignId) as { c: number }
  if (existing.c === 0) {
    seedClimateZones(db, campaignId)
  }

  const zones = db.prepare(
    'SELECT * FROM climate_zones WHERE campaign_id = ? AND deleted_at IS NULL ORDER BY name COLLATE NOCASE',
  ).all(campaignId) as ZoneRow[]
  if (zones.length === 0) return []

  const zoneIds = zones.map(z => z.id)
  const placeholders = zoneIds.map(() => '?').join(',')
  const profiles = db.prepare(
    `SELECT * FROM climate_zone_seasons WHERE zone_id IN (${placeholders})`,
  ).all(...zoneIds) as ProfileRow[]

  const profilesByZone = new Map<number, ClimateZoneWithProfiles['profiles']>()
  for (const p of profiles) {
    let distribution: WeatherDistribution = {}
    try {
      distribution = JSON.parse(p.weather_distribution) as WeatherDistribution
    }
    catch {
      // ignore — distribution stays empty, editor can repair it
    }
    const list = profilesByZone.get(p.zone_id) ?? []
    list.push({
      id: p.id,
      zone_id: p.zone_id,
      season_id: p.season_id,
      temp_min: p.temp_min,
      temp_max: p.temp_max,
      weather_distribution: distribution,
      created_at: p.created_at,
      updated_at: p.updated_at,
    })
    profilesByZone.set(p.zone_id, list)
  }

  return zones.map(z => ({
    id: z.id,
    campaign_id: z.campaign_id,
    name: z.name,
    color: z.color,
    icon: z.icon,
    created_at: z.created_at,
    updated_at: z.updated_at,
    profiles: profilesByZone.get(z.id) ?? [],
  }))
})
