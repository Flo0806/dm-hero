import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody(event)

  const { sessionId, imageUrl } = body

  if (!sessionId || !imageUrl) {
    throw createError({
      statusCode: 400,
      message: 'Session ID and image URL are required',
    })
  }

  // Check if session exists
  const session = db
    .prepare('SELECT id FROM sessions WHERE id = ? AND deleted_at IS NULL')
    .get(sessionId)

  if (!session) {
    throw createError({
      statusCode: 404,
      message: 'Session not found',
    })
  }

  // Get current max display_order for this session
  const maxDisplayOrder = db
    .prepare(
      `
    SELECT COALESCE(MAX(display_order), -1) as max_order
    FROM session_images
    WHERE session_id = ?
  `,
    )
    .get(sessionId) as { max_order: number }

  const displayOrder = maxDisplayOrder.max_order + 1

  // Check if this is the first image for this session
  const imageCount = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM session_images
    WHERE session_id = ?
  `,
    )
    .get(sessionId) as { count: number }

  const isPrimary = imageCount.count === 0 ? 1 : 0

  // Insert into session_images table
  const result = db
    .prepare(
      `
    INSERT INTO session_images (session_id, image_url, is_primary, display_order, created_at)
    VALUES (?, ?, ?, ?, ?)
  `,
    )
    .run(sessionId, imageUrl, isPrimary, displayOrder, new Date().toISOString())

  return {
    success: true,
    id: Number(result.lastInsertRowid),
    imageUrl,
  }
})
