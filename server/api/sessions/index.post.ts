import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody(event)

  const { campaignId, title, session_number, date, summary, notes } = body

  if (!campaignId || !title) {
    throw createError({
      statusCode: 400,
      message: 'Campaign ID and title are required',
    })
  }

  const result = db.prepare(`
    INSERT INTO sessions (campaign_id, session_number, title, date, summary, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    campaignId,
    session_number || null,
    title,
    date || null,
    summary || null,
    notes || null,
  )

  const session = db.prepare(`
    SELECT
      id,
      session_number,
      title,
      date,
      summary,
      notes,
      created_at,
      updated_at
    FROM sessions
    WHERE id = ?
  `).get(result.lastInsertRowid)

  return session
})
