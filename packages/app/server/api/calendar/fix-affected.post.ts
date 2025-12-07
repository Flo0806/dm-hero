import { getDb } from '~~/server/utils/db'

interface CalendarMonth {
  name: string
  days: number
  sort_order: number
}

interface FixResult {
  eventsFixed: number
  sessionsReset: number
}

export default defineEventHandler(async (event): Promise<FixResult> => {
  const db = getDb()
  const body = await readBody(event)

  const { campaignId, months: newMonths } = body as {
    campaignId: number
    months: CalendarMonth[]
  }

  const newMonthCount = newMonths.length
  const newMonthDays = newMonths.map((m) => m.days)
  const totalDaysNew = newMonths.reduce((sum, m) => sum + m.days, 0)

  // Fix events with deleted months - move to last month, last day
  const eventsWithDeletedMonth = db
    .prepare(
      `UPDATE calendar_events
       SET month = ?, day = ?, updated_at = CURRENT_TIMESTAMP
       WHERE campaign_id = ? AND month > ?`,
    )
    .run(newMonthCount, newMonthDays[newMonthCount - 1] || 30, campaignId, newMonthCount)

  // Fix events with day overflow - move to last valid day of that month
  let eventsWithDayOverflow = 0
  for (let monthIdx = 0; monthIdx < newMonthCount; monthIdx++) {
    const monthNum = monthIdx + 1
    const maxDays = newMonthDays[monthIdx]

    const result = db
      .prepare(
        `UPDATE calendar_events
         SET day = ?, updated_at = CURRENT_TIMESTAMP
         WHERE campaign_id = ? AND month = ? AND day > ?`,
      )
      .run(maxDays, campaignId, monthNum, maxDays)

    eventsWithDayOverflow += result.changes
  }

  // Reset sessions with invalid in_game_day values
  // We need to check if the absolute day converts to a valid date
  const sessions = db
    .prepare(
      `SELECT id, in_game_day_start, in_game_day_end
       FROM sessions
       WHERE campaign_id = ? AND (in_game_day_start IS NOT NULL OR in_game_day_end IS NOT NULL)`,
    )
    .all(campaignId) as Array<{
    id: number
    in_game_day_start: number | null
    in_game_day_end: number | null
  }>

  let sessionsReset = 0

  for (const sess of sessions) {
    let needsReset = false

    // Check each day value
    for (const dayValue of [sess.in_game_day_start, sess.in_game_day_end]) {
      if (dayValue === null) continue

      // Convert absolute day to day-in-year
      const dayInYear = ((dayValue - 1) % totalDaysNew) + 1

      // Find which month and day this corresponds to
      let remainingDays = dayInYear
      let validMonth = false

      for (let i = 0; i < newMonthCount; i++) {
        if (remainingDays <= newMonthDays[i]) {
          validMonth = true
          break
        }
        remainingDays -= newMonthDays[i]
      }

      if (!validMonth) {
        needsReset = true
        break
      }
    }

    if (needsReset) {
      db.prepare(
        `UPDATE sessions
         SET in_game_day_start = NULL, in_game_day_end = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      ).run(sess.id)
      sessionsReset++
    }
  }

  return {
    eventsFixed: eventsWithDeletedMonth.changes + eventsWithDayOverflow,
    sessionsReset,
  }
})
