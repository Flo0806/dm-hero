import { getDb } from '~~/server/utils/db'
import type { CampaignNote, CampaignNoteDbRow } from '~~/types/note'

export default defineEventHandler(async (event): Promise<CampaignNote[]> => {
  const query = getQuery(event)
  const campaignId = Number(query.campaignId)

  if (!campaignId || isNaN(campaignId)) {
    throw createError({ statusCode: 400, message: 'Campaign ID is required' })
  }

  const db = getDb()

  const notes = db
    .prepare(
      `
      SELECT id, campaign_id, content, completed, sort_order, created_at, updated_at
      FROM campaign_notes
      WHERE campaign_id = ?
      ORDER BY sort_order ASC, created_at ASC
    `,
    )
    .all(campaignId) as CampaignNoteDbRow[]

  // Convert SQLite integer to boolean
  return notes.map((note) => ({
    ...note,
    completed: note.completed === 1,
  }))
})
