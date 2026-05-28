/**
 * Climate zones — per-campaign profiles for the weather generator.
 *
 * One zone has N season profiles (`ClimateZoneSeason`), each with a
 * temperature range and a weather distribution that biases the generator.
 * If a campaign has `active_climate_zone_id` set, the generator uses that
 * zone's profile for the current day's season; otherwise it falls back to
 * the legacy season-only behaviour.
 */

/** Standard weather types the generator picks from. */
export const WEATHER_TYPES = [
  'sunny',
  'partlyCloudy',
  'cloudy',
  'rain',
  'thunderstorm',
  'snow',
  'heavySnow',
  'fog',
  'windy',
] as const

export type WeatherType = typeof WEATHER_TYPES[number]

/** Distribution: keys are weather types, values are unnormalised weights. */
export type WeatherDistribution = Partial<Record<WeatherType, number>>

export interface ClimateZone {
  id: number
  campaign_id: number
  name: string
  color: string | null
  icon: string | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface ClimateZoneSeason {
  id: number
  zone_id: number
  season_id: number
  temp_min: number
  temp_max: number
  /** Stored as JSON in DB, parsed `WeatherDistribution` on the way out. */
  weather_distribution: WeatherDistribution
  created_at: string
  updated_at: string
}

export interface ClimateZoneWithProfiles extends ClimateZone {
  /** Per-season profiles, keyed by season_id for fast lookup in the UI. */
  profiles: ClimateZoneSeason[]
}

/**
 * Preset templates seeded into every campaign that doesn't have a zone yet.
 * `weatherTypeBySeason` keys ('winter'|'spring'|'summer'|'autumn') match
 * `calendar_seasons.weather_type` — the seeder pairs each preset with the
 * matching season for that campaign.
 */
export interface ClimateZonePreset {
  name: string
  color: string
  icon: string
  bySeasonWeatherType: Record<
    'winter' | 'spring' | 'summer' | 'autumn',
    { temp_min: number, temp_max: number, weather_distribution: WeatherDistribution }
  >
}

export const CLIMATE_ZONE_PRESETS: readonly ClimateZonePreset[] = [
  {
    name: 'Tropisch',
    color: '#4CAF50',
    icon: 'mdi-palm-tree',
    bySeasonWeatherType: {
      winter: { temp_min: 18, temp_max: 28, weather_distribution: { sunny: 30, partlyCloudy: 25, cloudy: 15, rain: 25, thunderstorm: 5 } },
      spring: { temp_min: 22, temp_max: 32, weather_distribution: { sunny: 35, partlyCloudy: 20, cloudy: 10, rain: 25, thunderstorm: 10 } },
      summer: { temp_min: 24, temp_max: 34, weather_distribution: { sunny: 30, partlyCloudy: 20, cloudy: 10, rain: 25, thunderstorm: 15 } },
      autumn: { temp_min: 22, temp_max: 30, weather_distribution: { sunny: 30, partlyCloudy: 25, cloudy: 15, rain: 20, thunderstorm: 10 } },
    },
  },
  {
    name: 'Subtropisch',
    color: '#FFB74D',
    icon: 'mdi-weather-sunny',
    bySeasonWeatherType: {
      winter: { temp_min: 8, temp_max: 18, weather_distribution: { sunny: 25, partlyCloudy: 25, cloudy: 25, rain: 20, fog: 5 } },
      spring: { temp_min: 14, temp_max: 24, weather_distribution: { sunny: 35, partlyCloudy: 25, cloudy: 15, rain: 20, thunderstorm: 5 } },
      summer: { temp_min: 22, temp_max: 35, weather_distribution: { sunny: 40, partlyCloudy: 20, cloudy: 10, rain: 15, thunderstorm: 15 } },
      autumn: { temp_min: 15, temp_max: 25, weather_distribution: { sunny: 30, partlyCloudy: 25, cloudy: 20, rain: 20, fog: 5 } },
    },
  },
  {
    name: 'Gemäßigt',
    color: '#81C784',
    icon: 'mdi-tree',
    bySeasonWeatherType: {
      winter: { temp_min: -10, temp_max: 5, weather_distribution: { sunny: 10, partlyCloudy: 15, cloudy: 25, snow: 25, heavySnow: 10, fog: 10, windy: 5 } },
      spring: { temp_min: 5, temp_max: 18, weather_distribution: { sunny: 20, partlyCloudy: 25, cloudy: 20, rain: 20, thunderstorm: 5, fog: 5, windy: 5 } },
      summer: { temp_min: 18, temp_max: 35, weather_distribution: { sunny: 35, partlyCloudy: 25, cloudy: 15, rain: 10, thunderstorm: 10, windy: 5 } },
      autumn: { temp_min: 5, temp_max: 18, weather_distribution: { sunny: 15, partlyCloudy: 20, cloudy: 25, rain: 20, fog: 10, windy: 10 } },
    },
  },
  {
    name: 'Borealwald',
    color: '#26A69A',
    icon: 'mdi-pine-tree',
    bySeasonWeatherType: {
      winter: { temp_min: -25, temp_max: -5, weather_distribution: { sunny: 10, partlyCloudy: 10, cloudy: 20, snow: 30, heavySnow: 20, fog: 5, windy: 5 } },
      spring: { temp_min: -2, temp_max: 12, weather_distribution: { sunny: 15, partlyCloudy: 20, cloudy: 25, rain: 20, snow: 10, fog: 5, windy: 5 } },
      summer: { temp_min: 10, temp_max: 22, weather_distribution: { sunny: 25, partlyCloudy: 25, cloudy: 20, rain: 20, thunderstorm: 5, windy: 5 } },
      autumn: { temp_min: -2, temp_max: 10, weather_distribution: { sunny: 15, partlyCloudy: 15, cloudy: 25, rain: 20, snow: 10, fog: 10, windy: 5 } },
    },
  },
  {
    name: 'Tundra',
    color: '#90CAF9',
    icon: 'mdi-snowflake',
    bySeasonWeatherType: {
      winter: { temp_min: -35, temp_max: -15, weather_distribution: { sunny: 10, partlyCloudy: 10, cloudy: 20, snow: 25, heavySnow: 25, fog: 5, windy: 5 } },
      spring: { temp_min: -10, temp_max: 2, weather_distribution: { sunny: 15, partlyCloudy: 15, cloudy: 25, snow: 25, fog: 10, windy: 10 } },
      summer: { temp_min: 2, temp_max: 12, weather_distribution: { sunny: 25, partlyCloudy: 25, cloudy: 25, rain: 15, fog: 5, windy: 5 } },
      autumn: { temp_min: -10, temp_max: 2, weather_distribution: { sunny: 15, partlyCloudy: 15, cloudy: 25, snow: 20, fog: 15, windy: 10 } },
    },
  },
  {
    name: 'Wüste',
    color: '#FFA726',
    icon: 'mdi-cactus',
    bySeasonWeatherType: {
      winter: { temp_min: 5, temp_max: 20, weather_distribution: { sunny: 55, partlyCloudy: 25, cloudy: 10, rain: 5, windy: 5 } },
      spring: { temp_min: 15, temp_max: 30, weather_distribution: { sunny: 60, partlyCloudy: 20, cloudy: 10, rain: 5, windy: 5 } },
      summer: { temp_min: 28, temp_max: 45, weather_distribution: { sunny: 70, partlyCloudy: 15, cloudy: 5, thunderstorm: 5, windy: 5 } },
      autumn: { temp_min: 18, temp_max: 32, weather_distribution: { sunny: 60, partlyCloudy: 20, cloudy: 10, rain: 5, windy: 5 } },
    },
  },
] as const

/** Normalise raw weights so they sum to 100 — used by the generator. */
export function normaliseDistribution(d: WeatherDistribution): WeatherDistribution {
  const entries = Object.entries(d) as Array<[WeatherType, number]>
  const total = entries.reduce((sum, [, w]) => sum + (w > 0 ? w : 0), 0)
  if (total <= 0) return d
  const out: WeatherDistribution = {}
  for (const [type, w] of entries) {
    if (w > 0) out[type] = Math.round((w / total) * 100)
  }
  return out
}
