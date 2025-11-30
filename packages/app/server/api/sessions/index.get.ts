import { getDb } from '../../utils/db'

interface SessionRow {
  id: number
  session_number: number | null
  title: string
  date: string | null
  summary: string | null
  notes: string | null
  in_game_date_start: string | null
  in_game_date_end: string | null
  in_game_day_start: number | null
  in_game_day_end: number | null
  duration_minutes: number | null
  created_at: string
  updated_at: string
  mentions_count: number
  attendance_count: number
  cover_image_url: string | null
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

  // Get all Sessions for this campaign with counts and cover image
  const sessions = db
    .prepare(
      `
    SELECT
      s.id,
      s.session_number,
      s.title,
      s.date,
      s.summary,
      s.notes,
      s.in_game_date_start,
      s.in_game_date_end,
      s.in_game_day_start,
      s.in_game_day_end,
      s.duration_minutes,
      s.created_at,
      s.updated_at,
      (SELECT COUNT(*) FROM session_mentions WHERE session_id = s.id) as mentions_count,
      (SELECT COUNT(*) FROM session_attendance WHERE session_id = s.id) as attendance_count,
      (SELECT image_url FROM session_images WHERE session_id = s.id AND is_primary = 1 LIMIT 1) as cover_image_url
    FROM sessions s
    WHERE s.campaign_id = ?
      AND s.deleted_at IS NULL
    ORDER BY s.session_number DESC, s.date DESC
  `,
    )
    .all(campaignId) as SessionRow[]

  return sessions
})
