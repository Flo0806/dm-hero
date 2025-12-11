import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const imageId = getRouterParam(event, 'id')

  if (!imageId) {
    throw createError({
      statusCode: 400,
      message: 'Image ID is required',
    })
  }

  // Get image info
  const image = db
    .prepare('SELECT id, entity_id, image_url, is_primary FROM entity_images WHERE id = ?')
    .get(imageId) as
    | {
        id: number
        entity_id: number
        image_url: string
        is_primary: number
      }
    | undefined

  if (!image) {
    throw createError({
      statusCode: 404,
      message: 'Image not found',
    })
  }

  // Delete from storage
  const storage = useStorage('pictures')
  try {
    await storage.removeItem(image.image_url)
  } catch (error) {
    console.error('Failed to delete image file:', error)
    // Continue anyway
  }

  // Delete from database
  db.prepare('DELETE FROM entity_images WHERE id = ?').run(imageId)

  // If this was the primary image, set another image as primary and update entities.image_url
  if (image.is_primary === 1) {
    const nextImage = db
      .prepare(
        `
      SELECT id, image_url FROM entity_images
      WHERE entity_id = ?
      ORDER BY display_order ASC, created_at ASC
      LIMIT 1
    `,
      )
      .get(image.entity_id) as { id: number; image_url: string } | undefined

    if (nextImage) {
      db.prepare('UPDATE entity_images SET is_primary = 1 WHERE id = ?').run(nextImage.id)
      // Update entities.image_url to the new primary image
      db.prepare('UPDATE entities SET image_url = ?, updated_at = ? WHERE id = ?').run(
        nextImage.image_url,
        new Date().toISOString(),
        image.entity_id,
      )
    } else {
      // No more images, clear entities.image_url
      db.prepare('UPDATE entities SET image_url = NULL, updated_at = ? WHERE id = ?').run(
        new Date().toISOString(),
        image.entity_id,
      )
    }
  } else {
    // Update entity's updated_at
    db.prepare('UPDATE entities SET updated_at = ? WHERE id = ?').run(
      new Date().toISOString(),
      image.entity_id,
    )
  }

  return {
    success: true,
  }
})
