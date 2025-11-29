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

  // Get image info
  const image = db.prepare('SELECT id, entity_id FROM entity_images WHERE id = ?').get(imageId) as
    | {
        id: number
        entity_id: number
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

  // Update entity's updated_at
  db.prepare('UPDATE entities SET updated_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    image.entity_id,
  )

  return {
    success: true,
  }
})
