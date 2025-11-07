import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody(event)

  const { entityId, imageUrl } = body as {
    entityId: number
    imageUrl: string
  }

  if (!entityId || !imageUrl) {
    throw createError({
      statusCode: 400,
      message: 'Entity ID and image URL are required',
    })
  }

  // Check if entity exists
  const entity = db
    .prepare('SELECT id FROM entities WHERE id = ? AND deleted_at IS NULL')
    .get(entityId)

  if (!entity) {
    throw createError({
      statusCode: 404,
      message: 'Entity not found',
    })
  }

  // Get current max display_order for this entity
  const maxDisplayOrder = db
    .prepare(
      `
    SELECT COALESCE(MAX(display_order), -1) as max_order
    FROM entity_images
    WHERE entity_id = ?
  `,
    )
    .get(entityId) as { max_order: number }

  const displayOrder = maxDisplayOrder.max_order + 1

  // Check if this is the first image for this entity
  const imageCount = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM entity_images
    WHERE entity_id = ?
  `,
    )
    .get(entityId) as { count: number }

  const isPrimary = imageCount.count === 0 ? 1 : 0

  // Insert into entity_images table
  const result = db
    .prepare(
      `
    INSERT INTO entity_images (entity_id, image_url, is_primary, display_order, created_at)
    VALUES (?, ?, ?, ?, ?)
  `,
    )
    .run(entityId, imageUrl, isPrimary, displayOrder, new Date().toISOString())

  return {
    success: true,
    imageId: Number(result.lastInsertRowid),
    imageUrl,
  }
})
