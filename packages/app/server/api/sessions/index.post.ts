import { getDb } from '../../utils/db'
import { syncSessionMentions } from '../../utils/extract-mentions'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody(event)

  const {
    campaignId,
    title,
    session_number,
    date,
    summary,
    notes,
    in_game_date_start,
    in_game_date_end,
    in_game_year_start,
    in_game_month_start,
    in_game_day_start, // Day of month (1-31)
    in_game_year_end,
    in_game_month_end,
    in_game_day_end, // Day of month (1-31)
    duration_minutes,
  } = body

  if (!campaignId || !title) {
    throw createError({
      statusCode: 400,
      message: 'Campaign ID and title are required',
    })
  }

  const result = db
    .prepare(
      `
    INSERT INTO sessions (
      campaign_id, session_number, title, date, summary, notes,
      in_game_date_start, in_game_date_end,
      in_game_year_start, in_game_month_start, in_game_day_start,
      in_game_year_end, in_game_month_end, in_game_day_end,
      duration_minutes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      campaignId,
      session_number || null,
      title,
      date || null,
      summary || null,
      notes || null,
      in_game_date_start || null,
      in_game_date_end || null,
      in_game_year_start || null,
      in_game_month_start || null,
      in_game_day_start || null,
      in_game_year_end || null,
      in_game_month_end || null,
      in_game_day_end || null,
      duration_minutes || null,
    )

  const sessionId = result.lastInsertRowid as number

  // Sync session_mentions from markdown links in notes
  syncSessionMentions(db, sessionId, notes)

  const session = db
    .prepare(
      `
    SELECT
      id,
      session_number,
      title,
      date,
      summary,
      notes,
      in_game_date_start,
      in_game_date_end,
      in_game_year_start,
      in_game_month_start,
      in_game_day_start,
      in_game_year_end,
      in_game_month_end,
      in_game_day_end,
      duration_minutes,
      created_at,
      updated_at
    FROM sessions
    WHERE id = ?
  `,
    )
    .get(sessionId)

  return session
})
