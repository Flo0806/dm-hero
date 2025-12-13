import { getDb } from '~~/server/utils/db'

interface SuccessResponse {
  success: boolean
}

export default defineEventHandler(async (event): Promise<SuccessResponse> => {
  const id = Number(getRouterParam(event, 'id'))

  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Note ID is required' })
  }

  const db = getDb()

  const result = db.prepare('DELETE FROM campaign_notes WHERE id = ?').run(id)

  if (result.changes === 0) {
    throw createError({ statusCode: 404, message: 'Note not found' })
  }

  return { success: true }
})
