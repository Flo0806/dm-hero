import { getDb } from '../../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const noteId = getRouterParam(event, 'noteId')

  if (!noteId) {
    throw createError({
      statusCode: 400,
      message: 'Note ID is required',
    })
  }

  // Delete session mentions first (foreign key constraint)
  db.prepare(
    `
    DELETE FROM session_mentions WHERE session_id = ?
  `,
  ).run(noteId)

  // Delete session (note)
  db.prepare(
    `
    DELETE FROM sessions WHERE id = ?
  `,
  ).run(noteId)

  return { success: true }
})
