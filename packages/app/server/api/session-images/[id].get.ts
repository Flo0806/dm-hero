import { getDb } from '../../utils/db'

interface SessionImageRow {
  id: number
  session_id: number
  image_url: string
  caption: string | null
  is_primary: number
  display_order: number
  created_at: string
}

export default defineEventHandler((event) => {
  const db = getDb()
  const sessionId = getRouterParam(event, 'id')

  if (!sessionId) {
    throw createError({
      statusCode: 400,
      message: 'Session ID is required',
    })
  }

  // Get all images for this session, ordered by display_order
  const images = db
    .prepare(
      `
    SELECT id, session_id, image_url, caption, is_primary, display_order, created_at
    FROM session_images
    WHERE session_id = ?
    ORDER BY display_order ASC
  `,
    )
    .all(sessionId) as SessionImageRow[]

  return images.map((img) => ({
    id: img.id,
    sessionId: img.session_id,
    imageUrl: img.image_url,
    caption: img.caption,
    isPrimary: img.is_primary === 1,
    displayOrder: img.display_order,
    createdAt: img.created_at,
  }))
})
