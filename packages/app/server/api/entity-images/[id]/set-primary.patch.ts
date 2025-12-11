import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const imageId = getRouterParam(event, 'id')

  if (!imageId) {
    throw createError({
      statusCode: 400,
      message: 'Image ID is required',
    })
  }

  // Get image info including the image_url
  const image = db.prepare('SELECT id, entity_id, image_url FROM entity_images WHERE id = ?').get(imageId) as
    | {
        id: number
        entity_id: number
        image_url: string
      }
    | undefined

  if (!image) {
    throw createError({
      statusCode: 404,
      message: 'Image not found',
    })
  }

  // Unset all other primary images for this entity
  db.prepare('UPDATE entity_images SET is_primary = 0 WHERE entity_id = ?').run(image.entity_id)

  // Set this image as primary
  db.prepare('UPDATE entity_images SET is_primary = 1 WHERE id = ?').run(imageId)

  // Update entity's image_url and updated_at
  db.prepare('UPDATE entities SET image_url = ?, updated_at = ? WHERE id = ?').run(
    image.image_url,
    new Date().toISOString(),
    image.entity_id,
  )

  return {
    success: true,
  }
})
