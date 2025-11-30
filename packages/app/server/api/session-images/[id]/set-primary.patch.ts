import { getDb } from '../../../utils/db'

export default defineEventHandler((event) => {
  const db = getDb()
  const imageId = getRouterParam(event, 'id')

  if (!imageId) {
    throw createError({
      statusCode: 400,
      message: 'Image ID is required',
    })
  }

  // Get the image to find its session
  const image = db
    .prepare(
      `
    SELECT id, session_id
    FROM session_images
    WHERE id = ?
  `,
    )
    .get(imageId) as { id: number; session_id: number } | undefined

  if (!image) {
    throw createError({
      statusCode: 404,
      message: 'Image not found',
    })
  }

  // Reset all images for this session to non-primary
  db.prepare(
    `
    UPDATE session_images
    SET is_primary = 0
    WHERE session_id = ?
  `,
  ).run(image.session_id)

  // Set this image as primary
  db.prepare(
    `
    UPDATE session_images
    SET is_primary = 1
    WHERE id = ?
  `,
  ).run(imageId)

  return { success: true }
})
