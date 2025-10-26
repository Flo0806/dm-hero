import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const npcId = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!npcId) {
    throw createError({
      statusCode: 400,
      message: 'NPC ID is required',
    })
  }

  const { title, summary, date, notes, campaignId } = body

  if (!summary || !campaignId) {
    throw createError({
      statusCode: 400,
      message: 'Summary and campaign ID are required',
    })
  }

  // Create session (note)
  const result = db.prepare(`
    INSERT INTO sessions (title, summary, date, notes, campaign_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    title || null,
    summary,
    date || new Date().toISOString(),
    notes || null,
    campaignId,
  )

  const sessionId = result.lastInsertRowid

  // Link to NPC via session_mentions
  db.prepare(`
    INSERT INTO session_mentions (session_id, entity_id, context)
    VALUES (?, ?, ?)
  `).run(sessionId, npcId, null)

  // Return created note
  const note = db.prepare(`
    SELECT * FROM sessions WHERE id = ?
  `).get(sessionId)

  return note
})
