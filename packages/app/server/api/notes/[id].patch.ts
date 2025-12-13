import { getDb } from '~~/server/utils/db'
import type { UpdateNoteRequest, CampaignNote, CampaignNoteDbRow } from '~~/types/note'

export default defineEventHandler(async (event): Promise<CampaignNote> => {
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody<UpdateNoteRequest>(event)

  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Note ID is required' })
  }

  const db = getDb()

  // Check if note exists
  const existing = db.prepare('SELECT id FROM campaign_notes WHERE id = ?').get(id)

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Note not found' })
  }

  // Build update query dynamically
  const updates: string[] = []
  const values: (string | number)[] = []

  if (body.content !== undefined) {
    updates.push('content = ?')
    values.push(body.content.trim())
  }

  if (body.completed !== undefined) {
    updates.push('completed = ?')
    values.push(body.completed ? 1 : 0)
  }

  if (updates.length === 0) {
    throw createError({ statusCode: 400, message: 'No fields to update' })
  }

  updates.push('updated_at = CURRENT_TIMESTAMP')
  values.push(id)

  db.prepare(`UPDATE campaign_notes SET ${updates.join(', ')} WHERE id = ?`).run(...values)

  // Fetch the updated note
  const note = db.prepare('SELECT * FROM campaign_notes WHERE id = ?').get(id) as CampaignNoteDbRow

  return {
    ...note,
    completed: note.completed === 1,
  }
})
