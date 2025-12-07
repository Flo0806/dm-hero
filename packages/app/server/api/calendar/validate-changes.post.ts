import { getDb } from '~~/server/utils/db'

interface CalendarMonth {
  id?: number
  name: string
  days: number
  sort_order: number
}

interface ValidationResult {
  hasIssues: boolean
  affectedEvents: Array<{
    id: number
    title: string
    month: number
    day: number
    issue: 'month_deleted' | 'day_overflow'
  }>
  affectedSessions: Array<{
    id: number
    title: string
    session_number: number | null
    issue: 'day_overflow'
  }>
  totalDaysOld: number
  totalDaysNew: number
}

export default defineEventHandler(async (event): Promise<ValidationResult> => {
  const db = getDb()
  const body = await readBody(event)

  const { campaignId, months: newMonths } = body as {
    campaignId: number
    months: CalendarMonth[]
  }

  // Get current months configuration
  const currentMonths = db
    .prepare('SELECT * FROM calendar_months WHERE campaign_id = ? ORDER BY sort_order')
    .all(campaignId) as CalendarMonth[]

  // Calculate total days for old and new configuration
  const totalDaysOld = currentMonths.reduce((sum, m) => sum + m.days, 0)
  const totalDaysNew = newMonths.reduce((sum, m) => sum + m.days, 0)

  // Build month lookup for new configuration
  const newMonthDays = newMonths.map((m) => m.days)
  const newMonthCount = newMonths.length

  // Find affected events
  const events = db
    .prepare(
      `SELECT id, title, month, day FROM calendar_events
       WHERE campaign_id = ? AND month IS NOT NULL AND day IS NOT NULL`,
    )
    .all(campaignId) as Array<{ id: number; title: string; month: number; day: number }>

  const affectedEvents: ValidationResult['affectedEvents'] = []

  for (const evt of events) {
    // Check if month still exists
    if (evt.month > newMonthCount) {
      affectedEvents.push({
        id: evt.id,
        title: evt.title,
        month: evt.month,
        day: evt.day,
        issue: 'month_deleted',
      })
    } else {
      // Check if day still exists in that month
      const maxDays = newMonthDays[evt.month - 1] || 30
      if (evt.day > maxDays) {
        affectedEvents.push({
          id: evt.id,
          title: evt.title,
          month: evt.month,
          day: evt.day,
          issue: 'day_overflow',
        })
      }
    }
  }

  // Find affected sessions
  // Sessions use absolute days - if total days per year changes, ALL sessions with dates are affected
  // because the absolute day calculation will no longer map to the same month/day
  const sessions = db
    .prepare(
      `SELECT s.id, s.title, s.session_number, s.in_game_day_start, s.in_game_day_end
       FROM sessions s
       WHERE s.campaign_id = ? AND (s.in_game_day_start IS NOT NULL OR s.in_game_day_end IS NOT NULL)`,
    )
    .all(campaignId) as Array<{
    id: number
    title: string
    session_number: number | null
    in_game_day_start: number | null
    in_game_day_end: number | null
  }>

  const affectedSessions: ValidationResult['affectedSessions'] = []

  // If total days per year changed, ALL sessions with in-game dates are affected
  // because absolute day -> month/day conversion will be different
  if (totalDaysOld !== totalDaysNew && sessions.length > 0) {
    for (const sess of sessions) {
      affectedSessions.push({
        id: sess.id,
        title: sess.title,
        session_number: sess.session_number,
        issue: 'day_overflow',
      })
    }
  } else {
    // Even if total days are same, check if individual month days changed
    // which would affect sessions in those months
    for (const sess of sessions) {
      const maxDay = Math.max(sess.in_game_day_start || 0, sess.in_game_day_end || 0)

      if (maxDay > 0 && totalDaysNew > 0) {
        const dayInYear = ((maxDay - 1) % totalDaysNew) + 1

        // Find which month this day falls into
        let remainingDays = dayInYear
        let foundMonth = false

        for (let i = 0; i < newMonthCount; i++) {
          if (remainingDays <= newMonthDays[i]) {
            foundMonth = true
            break
          }
          remainingDays -= newMonthDays[i]
        }

        // If day doesn't fit in any month, it's affected
        if (!foundMonth) {
          affectedSessions.push({
            id: sess.id,
            title: sess.title,
            session_number: sess.session_number,
            issue: 'day_overflow',
          })
        }
      }
    }
  }

  return {
    hasIssues: affectedEvents.length > 0 || affectedSessions.length > 0,
    affectedEvents,
    affectedSessions,
    totalDaysOld,
    totalDaysNew,
  }
})
