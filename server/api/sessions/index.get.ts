import { getDb } from '../../utils/db'

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

  // Get all Sessions for this campaign
  const sessions = db.prepare(`
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
    WHERE campaign_id = ?
      AND deleted_at IS NULL
    ORDER BY session_number DESC, date DESC
  `).all(campaignId)

  return sessions
})
