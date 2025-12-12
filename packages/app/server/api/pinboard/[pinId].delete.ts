import { getDb } from '~~/server/utils/db'
import type { SuccessResponse } from '~~/types/pinboard'

export default defineEventHandler(async (event): Promise<SuccessResponse> => {
  const pinIdParam = getRouterParam(event, 'pinId')
  const pinId = Number(pinIdParam)

  if (!pinId || isNaN(pinId)) {
    throw createError({ statusCode: 400, message: 'Pin ID is required' })
  }

  const db = getDb()

  // Delete the pin
  const result = db.prepare('DELETE FROM pinboard WHERE id = ?').run(pinId)

  if (result.changes === 0) {
    throw createError({ statusCode: 404, message: 'Pin not found' })
  }

  return { success: true }
})
