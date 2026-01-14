import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody(event)

  const { entityId, imageUrl, makePrimary } = body as {
    entityId: number
    imageUrl: string
    makePrimary?: boolean
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

  // Get current count and max display_order in one query
  const stats = db
    .prepare(
      `
    SELECT COUNT(*) as count, COALESCE(MAX(display_order), -1) as max_order
    FROM entity_images
    WHERE entity_id = ?
  `,
    )
    .get(entityId) as { count: number; max_order: number }

  const displayOrder = stats.max_order + 1

  // Set as primary if: explicitly requested OR first image for this entity
  const shouldBePrimary = makePrimary === true || stats.count === 0

  // If making this primary, unset all other primary images first
  if (shouldBePrimary && stats.count > 0) {
    db.prepare('UPDATE entity_images SET is_primary = 0 WHERE entity_id = ?').run(entityId)
  }

  // Insert into entity_images table
  const result = db
    .prepare(
      `
    INSERT INTO entity_images (entity_id, image_url, is_primary, display_order, created_at)
    VALUES (?, ?, ?, ?, ?)
  `,
    )
    .run(entityId, imageUrl, shouldBePrimary ? 1 : 0, displayOrder, new Date().toISOString())

  // If this is primary, also update entities.image_url
  if (shouldBePrimary) {
    db.prepare('UPDATE entities SET image_url = ?, updated_at = ? WHERE id = ?').run(
      imageUrl,
      new Date().toISOString(),
      entityId,
    )
  }

  return {
    success: true,
    imageId: Number(result.lastInsertRowid),
    imageUrl,
  }
})
