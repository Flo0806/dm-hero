import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const markerId = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!markerId) {
    throw createError({
      statusCode: 400,
      message: 'Marker ID is required',
    })
  }

  const { timestampSeconds, label, description, color } = body

  // Build update query dynamically
  const updates: string[] = []
  const values: (string | number | null)[] = []

  if (timestampSeconds !== undefined) {
    updates.push('timestamp_seconds = ?')
    values.push(timestampSeconds)
  }

  if (label !== undefined) {
    updates.push('label = ?')
    values.push(label)
  }

  if (description !== undefined) {
    updates.push('description = ?')
    values.push(description || null)
  }

  if (color !== undefined) {
    updates.push('color = ?')
    values.push(color)
  }

  if (updates.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No fields to update',
    })
  }

  values.push(markerId)

  const result = db
    .prepare(`UPDATE audio_markers SET ${updates.join(', ')} WHERE id = ?`)
    .run(...values)

  if (result.changes === 0) {
    throw createError({
      statusCode: 404,
      message: 'Marker not found',
    })
  }

  return { success: true }
})
