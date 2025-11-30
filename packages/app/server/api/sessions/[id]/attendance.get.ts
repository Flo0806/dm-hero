import { getDb } from '../../../utils/db'

interface AttendanceRow {
  id: number
  session_id: number
  player_id: number
  character_id: number | null
  attended: number
  notes: string | null
  created_at: string
  player_name: string
  player_image: string | null
  character_name: string | null
  character_image: string | null
}

export default defineEventHandler((event) => {
  const db = getDb()
  const sessionId = getRouterParam(event, 'id')

  if (!sessionId) {
    throw createError({
      statusCode: 400,
      message: 'Session ID is required',
    })
  }

  // Get attendance with player and character info
  const attendance = db
    .prepare(
      `
    SELECT
      sa.id,
      sa.session_id,
      sa.player_id,
      sa.character_id,
      sa.attended,
      sa.notes,
      sa.created_at,
      p.name as player_name,
      p.image_url as player_image,
      c.name as character_name,
      c.image_url as character_image
    FROM session_attendance sa
    INNER JOIN entities p ON p.id = sa.player_id
    LEFT JOIN entities c ON c.id = sa.character_id
    WHERE sa.session_id = ?
    ORDER BY p.name
  `,
    )
    .all(sessionId) as AttendanceRow[]

  return attendance
})
