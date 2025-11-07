import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const entityId = getRouterParam(event, 'id')

  if (!entityId) {
    throw createError({
      statusCode: 400,
      message: 'Entity ID is required',
    })
  }

  // Get entity with image URL
  const entity = db
    .prepare('SELECT id, image_url FROM entities WHERE id = ? AND deleted_at IS NULL')
    .get(entityId) as { id: number; image_url: string | null } | undefined

  if (!entity) {
    throw createError({
      statusCode: 404,
      message: 'Entity not found',
    })
  }

  if (!entity.image_url) {
    throw createError({
      statusCode: 400,
      message: 'Entity has no image',
    })
  }

  // Delete image from storage
  const storage = useStorage('pictures')
  try {
    await storage.removeItem(entity.image_url)
  } catch (error) {
    console.error('Failed to delete image from storage:', error)
    // Continue anyway to update database
  }

  // Update entity to remove image URL
  db.prepare('UPDATE entities SET image_url = NULL, updated_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    entityId,
  )

  return {
    success: true,
  }
})
