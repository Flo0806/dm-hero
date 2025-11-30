import { getDb } from '../../utils/db'

interface MonthInput {
  id?: number
  name: string
  days: number
  sort_order: number
}

interface WeekdayInput {
  id?: number
  name: string
  sort_order: number
}

interface MoonInput {
  id?: number
  name: string
  cycle_days: number
  full_moon_duration: number
  new_moon_duration: number
  phase_offset: number
}

interface ConfigInput {
  campaignId: number
  currentYear: number
  currentMonth: number
  currentDay: number
  yearZeroName: string
  eraName: string
  leapYearInterval: number
  leapYearMonth: number
  leapYearExtraDays: number
  months: MonthInput[]
  weekdays: WeekdayInput[]
  moons: MoonInput[]
}

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody<ConfigInput>(event)

  if (!body.campaignId) {
    throw createError({
      statusCode: 400,
      message: 'Campaign ID is required',
    })
  }

  // Update or insert config
  const existingConfig = db
    .prepare('SELECT id FROM calendar_config WHERE campaign_id = ?')
    .get(body.campaignId)

  if (existingConfig) {
    db.prepare(`
      UPDATE calendar_config
      SET current_year = ?, current_month = ?, current_day = ?, year_zero_name = ?,
          era_name = ?, leap_year_interval = ?, leap_year_month = ?, leap_year_extra_days = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE campaign_id = ?
    `).run(
      body.currentYear,
      body.currentMonth,
      body.currentDay,
      body.yearZeroName || '',
      body.eraName || '',
      body.leapYearInterval || 0,
      body.leapYearMonth || 1,
      body.leapYearExtraDays || 1,
      body.campaignId,
    )
  } else {
    db.prepare(`
      INSERT INTO calendar_config (campaign_id, current_year, current_month, current_day, year_zero_name, era_name, leap_year_interval, leap_year_month, leap_year_extra_days)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      body.campaignId,
      body.currentYear,
      body.currentMonth,
      body.currentDay,
      body.yearZeroName || '',
      body.eraName || '',
      body.leapYearInterval || 0,
      body.leapYearMonth || 1,
      body.leapYearExtraDays || 1,
    )
  }

  // Delete and recreate months (simpler than upsert logic)
  db.prepare('DELETE FROM calendar_months WHERE campaign_id = ?').run(body.campaignId)
  const insertMonth = db.prepare(`
    INSERT INTO calendar_months (campaign_id, name, days, sort_order)
    VALUES (?, ?, ?, ?)
  `)
  for (const month of body.months) {
    insertMonth.run(body.campaignId, month.name, month.days, month.sort_order)
  }

  // Delete and recreate weekdays
  db.prepare('DELETE FROM calendar_weekdays WHERE campaign_id = ?').run(body.campaignId)
  const insertWeekday = db.prepare(`
    INSERT INTO calendar_weekdays (campaign_id, name, sort_order)
    VALUES (?, ?, ?)
  `)
  for (const weekday of body.weekdays) {
    insertWeekday.run(body.campaignId, weekday.name, weekday.sort_order)
  }

  // Delete and recreate moons
  db.prepare('DELETE FROM calendar_moons WHERE campaign_id = ?').run(body.campaignId)
  const insertMoon = db.prepare(`
    INSERT INTO calendar_moons (campaign_id, name, cycle_days, full_moon_duration, new_moon_duration, phase_offset)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  for (const moon of body.moons) {
    insertMoon.run(
      body.campaignId,
      moon.name,
      moon.cycle_days,
      moon.full_moon_duration,
      moon.new_moon_duration,
      moon.phase_offset,
    )
  }

  return { success: true }
})
