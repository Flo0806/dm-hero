import { getDb } from '../../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const noteId = getRouterParam(event, 'noteId')
  const body = await readBody(event)

  if (!noteId) {
    throw createError({
      statusCode: 400,
      message: 'Note ID is required',
    })
  }

  const { title, summary, date, notes } = body

  if (!summary) {
    throw createError({
      statusCode: 400,
      message: 'Summary is required',
    })
  }

  // Update session (note)
  db.prepare(
    `
    UPDATE sessions
    SET
      title = ?,
      summary = ?,
      date = ?,
      notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
  ).run(title || null, summary, date || null, notes || null, noteId)

  // Return updated note
  const note = db
    .prepare(
      `
    SELECT * FROM sessions WHERE id = ?
  `,
    )
    .get(noteId)

  if (!note) {
    throw createError({
      statusCode: 404,
      message: 'Note not found',
    })
  }

  return note
})
