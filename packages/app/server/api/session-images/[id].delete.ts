import { unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { getDb } from '../../utils/db'
import { getUploadPath } from '../../utils/paths'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const imageId = getRouterParam(event, 'id')

  if (!imageId) {
    throw createError({
      statusCode: 400,
      message: 'Image ID is required',
    })
  }

  // Get the image record
  const image = db
    .prepare(
      `
    SELECT id, session_id, image_url, is_primary
    FROM session_images
    WHERE id = ?
  `,
    )
    .get(imageId) as { id: number; session_id: number; image_url: string; is_primary: number } | undefined

  if (!image) {
    throw createError({
      statusCode: 404,
      message: 'Image not found',
    })
  }

  // Delete from database
  db.prepare('DELETE FROM session_images WHERE id = ?').run(imageId)

  // Delete file from disk
  try {
    const filePath = join(getUploadPath(), image.image_url)
    await unlink(filePath)
  } catch (error) {
    console.warn(`Failed to delete file ${image.image_url}:`, error)
    // Continue even if file deletion fails
  }

  // If this was the primary image, set the next image as primary
  if (image.is_primary === 1) {
    const nextImage = db
      .prepare(
        `
      SELECT id FROM session_images
      WHERE session_id = ?
      ORDER BY display_order ASC
      LIMIT 1
    `,
      )
      .get(image.session_id) as { id: number } | undefined

    if (nextImage) {
      db.prepare('UPDATE session_images SET is_primary = 1 WHERE id = ?').run(nextImage.id)
    }
  }

  return { success: true }
})
