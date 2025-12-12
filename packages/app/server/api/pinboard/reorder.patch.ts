import { getDb } from '~~/server/utils/db'
import type { ReorderPinsRequest, SuccessResponse } from '~~/types/pinboard'

export default defineEventHandler(async (event): Promise<SuccessResponse> => {
  const body = await readBody<ReorderPinsRequest>(event)

  if (!body.pinIds || !Array.isArray(body.pinIds)) {
    throw createError({ statusCode: 400, message: 'pinIds array is required' })
  }

  const db = getDb()

  // Update display_order for each pin based on array position
  const updateStmt = db.prepare('UPDATE pinboard SET display_order = ? WHERE id = ?')

  const transaction = db.transaction((pinIds: number[]) => {
    pinIds.forEach((pinId, index) => {
      updateStmt.run(index, pinId)
    })
  })

  try {
    transaction(body.pinIds)
    return { success: true }
  } catch {
    throw createError({ statusCode: 500, message: 'Failed to reorder pins' })
  }
})
