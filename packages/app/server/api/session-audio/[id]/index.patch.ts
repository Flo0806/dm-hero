import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const audioId = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!audioId) {
    throw createError({
      statusCode: 400,
      message: 'Audio ID is required',
    })
  }

  const { title, description, durationSeconds } = body

  // Build update query dynamically
  const updates: string[] = []
  const values: (string | number | null)[] = []

  if (title !== undefined) {
    updates.push('title = ?')
    values.push(title || null)
  }

  if (description !== undefined) {
    updates.push('description = ?')
    values.push(description || null)
  }

  if (durationSeconds !== undefined) {
    updates.push('duration_seconds = ?')
    values.push(durationSeconds)
  }

  if (updates.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No fields to update',
    })
  }

  values.push(audioId)

  const result = db
    .prepare(`UPDATE session_audio SET ${updates.join(', ')} WHERE id = ?`)
    .run(...values)

  if (result.changes === 0) {
    throw createError({
      statusCode: 404,
      message: 'Audio file not found',
    })
  }

  return { success: true }
})
