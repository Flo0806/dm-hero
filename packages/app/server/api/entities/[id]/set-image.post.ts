import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')
  const body = await readBody<{ imageUrl: string }>(event)

  if (!id || !body?.imageUrl) {
    throw createError({
      statusCode: 400,
      message: 'Entity ID and image URL are required',
    })
  }

  try {
    const entityId = Number(id)

    // Check if this image already exists in entity_images
    const existingImage = db
      .prepare('SELECT id FROM entity_images WHERE entity_id = ? AND image_url = ?')
      .get(entityId, body.imageUrl) as { id: number } | undefined

    if (!existingImage) {
      // Reset any existing primary images
      db.prepare('UPDATE entity_images SET is_primary = 0 WHERE entity_id = ?').run(entityId)

      // Get max display order
      const maxOrderResult = db
        .prepare('SELECT COALESCE(MAX(display_order), -1) as max_order FROM entity_images WHERE entity_id = ?')
        .get(entityId) as { max_order: number }

      // Add to entity_images as primary
      db.prepare(
        `
        INSERT INTO entity_images (entity_id, image_url, is_primary, display_order)
        VALUES (?, ?, 1, ?)
      `,
      ).run(entityId, body.imageUrl, maxOrderResult.max_order + 1)
    } else {
      // Image exists - make it primary
      db.prepare('UPDATE entity_images SET is_primary = 0 WHERE entity_id = ?').run(entityId)
      db.prepare('UPDATE entity_images SET is_primary = 1 WHERE id = ?').run(existingImage.id)
    }

    // Update entity image_url
    db.prepare(
      `
      UPDATE entities
      SET image_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    ).run(body.imageUrl, id)

    return { success: true }
  } catch (error) {
    console.error('[Set Image] Error:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to update image',
    })
  }
})
