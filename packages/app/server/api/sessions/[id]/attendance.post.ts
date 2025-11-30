import { getDb } from '../../../utils/db'

interface AttendanceInput {
  player_id: number
  character_id?: number | null
  attended: boolean
  notes?: string | null
}

export default defineEventHandler(async (event) => {
  const db = getDb()
  const sessionId = getRouterParam(event, 'id')
  const body = await readBody<{ attendance: AttendanceInput[] }>(event)

  if (!sessionId) {
    throw createError({
      statusCode: 400,
      message: 'Session ID is required',
    })
  }

  if (!body.attendance || !Array.isArray(body.attendance)) {
    throw createError({
      statusCode: 400,
      message: 'Attendance array is required',
    })
  }

  const sessionIdNum = parseInt(sessionId, 10)

  // Use a transaction to update all attendance records
  const updateAttendance = db.transaction(() => {
    // Delete existing attendance for this session
    db.prepare('DELETE FROM session_attendance WHERE session_id = ?').run(sessionIdNum)

    // Insert new attendance records
    const insertStmt = db.prepare(`
      INSERT INTO session_attendance (session_id, player_id, character_id, attended, notes)
      VALUES (?, ?, ?, ?, ?)
    `)

    for (const record of body.attendance) {
      insertStmt.run(
        sessionIdNum,
        record.player_id,
        record.character_id || null,
        record.attended ? 1 : 0,
        record.notes || null,
      )
    }
  })

  updateAttendance()

  // Return updated attendance list
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
    .all(sessionIdNum)

  return { success: true, attendance }
})
