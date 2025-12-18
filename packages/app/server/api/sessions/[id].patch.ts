import { getDb } from '../../utils/db'
import { syncSessionMentions } from '../../utils/extract-mentions'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Session ID is required',
    })
  }

  const {
    title,
    session_number,
    summary,
    date,
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

  db.prepare(
    `
    UPDATE sessions
    SET
      title = COALESCE(?, title),
      session_number = ?,
      summary = ?,
      date = ?,
      notes = ?,
      in_game_date_start = ?,
      in_game_date_end = ?,
      in_game_year_start = ?,
      in_game_month_start = ?,
      in_game_day_start = ?,
      in_game_year_end = ?,
      in_game_month_end = ?,
      in_game_day_end = ?,
      duration_minutes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND deleted_at IS NULL
  `,
  ).run(
    title,
    session_number,
    summary,
    date,
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
    id,
  )

  // Sync session_mentions from markdown links in notes
  syncSessionMentions(db, parseInt(id, 10), notes)

  const session = db
    .prepare(
      `
    SELECT * FROM sessions WHERE id = ? AND deleted_at IS NULL
  `,
    )
    .get(id)

  if (!session) {
    throw createError({
      statusCode: 404,
      message: 'Session not found',
    })
  }

  return session
})
