import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const imageId = getRouterParam(event, 'imageId')

  if (!imageId) {
    throw createError({
      statusCode: 400,
      message: 'Image ID is required',
    })
  }

  // Get image info
  const image = db.prepare('SELECT id, entity_id, image_url, is_primary FROM entity_images WHERE id = ?').get(imageId) as {
    id: number
    entity_id: number
    image_url: string
    is_primary: number
  } | undefined

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
  }
  catch (error) {
    console.error('Failed to delete image file:', error)
    // Continue anyway
  }

  // Delete from database
  db.prepare('DELETE FROM entity_images WHERE id = ?').run(imageId)

  // If this was the primary image, set another image as primary
  if (image.is_primary === 1) {
    const nextImage = db.prepare(`
      SELECT id FROM entity_images
      WHERE entity_id = ?
      ORDER BY display_order ASC, created_at ASC
      LIMIT 1
    `).get(image.entity_id) as { id: number } | undefined

    if (nextImage) {
      db.prepare('UPDATE entity_images SET is_primary = 1 WHERE id = ?').run(nextImage.id)
    }
  }

  // Update entity's updated_at
  db.prepare('UPDATE entities SET updated_at = ? WHERE id = ?')
    .run(new Date().toISOString(), image.entity_id)

  return {
    success: true,
  }
})
