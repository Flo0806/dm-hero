import { getDb } from '../../utils/db'

interface CalendarSession {
  id: number
  session_number: number | null
  title: string
  summary: string | null
  in_game_day_start: number | null
  in_game_day_end: number | null
  date: string | null // Real-world date
  duration_minutes: number | null
  attendance_count: number
  mentions_count: number
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

  // Get all sessions that have in-game dates set
  // These will be displayed on the calendar
  const sessions = db
    .prepare(
      `
    SELECT
      s.id,
      s.session_number,
      s.title,
      s.summary,
      s.in_game_day_start,
      s.in_game_day_end,
      s.date,
      s.duration_minutes,
      (SELECT COUNT(*) FROM session_attendance WHERE session_id = s.id) as attendance_count,
      (SELECT COUNT(*) FROM session_mentions WHERE session_id = s.id) as mentions_count
    FROM sessions s
    WHERE s.campaign_id = ?
      AND s.deleted_at IS NULL
      AND s.in_game_day_start IS NOT NULL
    ORDER BY s.in_game_day_start ASC, s.session_number ASC
  `,
    )
    .all(campaignId) as CalendarSession[]

  return sessions
})
