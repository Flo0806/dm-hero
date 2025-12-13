import { getDb } from '~~/server/utils/db'
import type { ReorderNotesRequest } from '~~/types/note'

interface SuccessResponse {
  success: boolean
}

export default defineEventHandler(async (event): Promise<SuccessResponse> => {
  const body = await readBody<ReorderNotesRequest>(event)

  if (!body.noteIds || !Array.isArray(body.noteIds)) {
    throw createError({ statusCode: 400, message: 'noteIds array is required' })
  }

  const db = getDb()

  const updateStmt = db.prepare('UPDATE campaign_notes SET sort_order = ? WHERE id = ?')

  const transaction = db.transaction((noteIds: number[]) => {
    noteIds.forEach((noteId, index) => {
      updateStmt.run(index, noteId)
    })
  })

  try {
    transaction(body.noteIds)
    return { success: true }
  } catch {
    throw createError({ statusCode: 500, message: 'Failed to reorder notes' })
  }
})
