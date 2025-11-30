import { getDb } from '../../../utils/db'

export default defineEventHandler((event) => {
  const db = getDb()
  const entityId = getRouterParam(event, 'id')

  if (!entityId) {
    throw createError({
      statusCode: 400,
      message: 'Entity ID is required',
    })
  }

  // Get all images for this entity
  const images = db
    .prepare(
      `
    SELECT id, entity_id, image_url, caption, is_primary, display_order, created_at
    FROM entity_images
    WHERE entity_id = ?
    ORDER BY display_order ASC, created_at ASC
  `,
    )
    .all(entityId)

  return images
})
