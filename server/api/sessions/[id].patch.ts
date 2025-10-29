import { getDb } from '../../utils/db'

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

  const { title, session_number, summary, date, notes } = body

  db.prepare(`
    UPDATE sessions
    SET
      title = COALESCE(?, title),
      session_number = ?,
      summary = ?,
      date = ?,
      notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND deleted_at IS NULL
  `).run(title, session_number, summary, date, notes, id)

  const session = db.prepare(`
    SELECT * FROM sessions WHERE id = ? AND deleted_at IS NULL
  `).get(id)

  if (!session) {
    throw createError({
      statusCode: 404,
      message: 'Session not found',
    })
  }

  return session
})
