import { getDb } from '../../utils/db'

interface CalendarConfig {
  id: number
  campaign_id: number
  current_year: number
  current_month: number
  current_day: number
  year_zero_name: string
  era_name: string
  leap_year_interval: number
  leap_year_month: number
  leap_year_extra_days: number
}

interface CalendarMonth {
  id: number
  name: string
  days: number
  sort_order: number
}

interface CalendarWeekday {
  id: number
  name: string
  sort_order: number
}

interface CalendarMoon {
  id: number
  name: string
  cycle_days: number
  full_moon_duration: number
  new_moon_duration: number
  phase_offset: number
}

export default defineEventHandler((event) => {
  const db = getDb()
  const query = getQuery(event)
  const campaignId = query.campaignId as string

  if (!campaignId) {
    throw createError({
      statusCode: 400,
      message: 'Campaign ID is required',
    })
  }

  // Get or create calendar config
  let config = db
    .prepare('SELECT * FROM calendar_config WHERE campaign_id = ?')
    .get(Number(campaignId)) as CalendarConfig | undefined

  if (!config) {
    // Create default config
    db.prepare(
      'INSERT INTO calendar_config (campaign_id) VALUES (?)',
    ).run(Number(campaignId))

    config = db
      .prepare('SELECT * FROM calendar_config WHERE campaign_id = ?')
      .get(Number(campaignId)) as CalendarConfig
  }

  // Get months
  const months = db
    .prepare('SELECT * FROM calendar_months WHERE campaign_id = ? ORDER BY sort_order')
    .all(Number(campaignId)) as CalendarMonth[]

  // Get weekdays
  const weekdays = db
    .prepare('SELECT * FROM calendar_weekdays WHERE campaign_id = ? ORDER BY sort_order')
    .all(Number(campaignId)) as CalendarWeekday[]

  // Get moons
  const moons = db
    .prepare('SELECT * FROM calendar_moons WHERE campaign_id = ?')
    .all(Number(campaignId)) as CalendarMoon[]

  return {
    config,
    months,
    weekdays,
    moons,
  }
})
