import { getDb } from '~~/server/utils/db'
import type { CreateNoteRequest, CampaignNote, CampaignNoteDbRow } from '~~/types/note'

interface MaxOrderRow {
  max_order: number | null
}

export default defineEventHandler(async (event): Promise<CampaignNote> => {
  const body = await readBody<CreateNoteRequest>(event)

  if (!body.campaignId) {
    throw createError({ statusCode: 400, message: 'Campaign ID is required' })
  }

  if (!body.content || body.content.trim() === '') {
    throw createError({ statusCode: 400, message: 'Content is required' })
  }

  const db = getDb()

  // Get the next sort order
  const maxOrder = db
    .prepare('SELECT MAX(sort_order) as max_order FROM campaign_notes WHERE campaign_id = ?')
    .get(body.campaignId) as MaxOrderRow | undefined

  const sortOrder = (maxOrder?.max_order ?? -1) + 1

  const result = db
    .prepare(
      `
      INSERT INTO campaign_notes (campaign_id, content, sort_order)
      VALUES (?, ?, ?)
    `,
    )
    .run(body.campaignId, body.content.trim(), sortOrder)

  // Fetch the created note
  const note = db
    .prepare('SELECT * FROM campaign_notes WHERE id = ?')
    .get(result.lastInsertRowid) as CampaignNoteDbRow

  return {
    ...note,
    completed: note.completed === 1,
  }
})
