// Calendar types

export type WeatherType = 'winter' | 'spring' | 'summer' | 'autumn'

export interface CalendarSeason {
  id: number
  campaign_id: number
  name: string
  start_month: number
  start_day: number
  background_image: string | null
  color: string | null
  icon: string | null
  sort_order: number
  weather_type: WeatherType
  created_at: string
  updated_at: string
}

export interface CreateSeasonPayload {
  name: string
  start_month: number
  start_day: number
  background_image?: string | null
  color?: string | null
  icon?: string | null
  sort_order?: number
  weather_type?: WeatherType
}

export interface UpdateSeasonPayload {
  name?: string
  start_month?: number
  start_day?: number
  background_image?: string | null
  color?: string | null
  icon?: string | null
  sort_order?: number
  weather_type?: WeatherType
}

// Calendar event entity linking
export interface CalendarEventEntity {
  id: number
  event_id: number
  entity_id: number
  entity_type: string | null
  created_at: string
  // Joined fields
  entity_name?: string
  entity_deleted?: boolean
}

// Extended calendar event with linked entities
export interface CalendarEvent {
  id: number
  campaign_id: number
  title: string
  description: string | null
  event_type: string
  year: number | null
  month: number
  day: number
  is_recurring: number
  entity_id: number | null // Legacy single entity link
  color: string | null
  created_at: string
  updated_at: string
  // New: linked entities array
  linked_entities?: CalendarEventEntity[]
}

export interface CreateEventPayload {
  title: string
  description?: string | null
  event_type?: string
  year?: number | null
  month: number
  day: number
  is_recurring?: boolean
  entity_ids?: number[] // Multiple entity IDs
  color?: string | null
}

export interface UpdateEventPayload {
  title?: string
  description?: string | null
  event_type?: string
  year?: number | null
  month?: number
  day?: number
  is_recurring?: boolean
  entity_ids?: number[] // Replace all linked entities
  color?: string | null
}

// Default season icons
export const SEASON_ICONS = [
  'mdi-snowflake', // Winter
  'mdi-flower', // Spring
  'mdi-white-balance-sunny', // Summer
  'mdi-leaf', // Autumn
  'mdi-weather-partly-cloudy', // Generic
  'mdi-weather-fog', // Fog
  'mdi-weather-windy', // Windy
  'mdi-weather-lightning-rainy', // Storm
] as const

// Default season colors
export const SEASON_COLORS = [
  '#B3E5FC', // Winter - light blue
  '#C8E6C9', // Spring - light green
  '#FFF9C4', // Summer - light yellow
  '#FFCCBC', // Autumn - light orange
  '#E1BEE7', // Other - light purple
  '#D7CCC8', // Neutral - light brown
] as const
