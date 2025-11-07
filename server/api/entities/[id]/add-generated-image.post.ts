import { getDb } from '../../../utils/db'

interface AddGeneratedImageRequest {
  imageUrl: string // Just the filename (without /uploads/ prefix)
}

export default defineEventHandler(async (event) => {
  const entityId = getRouterParam(event, 'id')
  const body = await readBody<AddGeneratedImageRequest>(event)

  if (!entityId || !body?.imageUrl) {
    throw createError({
      statusCode: 400,
      message: 'Entity ID and image URL are required',
    })
  }

  const db = getDb()

  try {
    // Get current image count to set display_order
    const count = db
      .prepare('SELECT COUNT(*) as count FROM entity_images WHERE entity_id = ?')
      .get(Number(entityId)) as { count: number }

    // Insert the generated image into entity_images
    const result = db
      .prepare(
        `
      INSERT INTO entity_images (entity_id, image_url, is_primary, display_order)
      VALUES (?, ?, ?, ?)
    `,
      )
      .run(
        Number(entityId),
        body.imageUrl,
        count.count === 0 ? 1 : 0, // First image is primary
        count.count,
      )

    // If this is the first image (primary), update the entity's image_url
    if (count.count === 0) {
      db.prepare('UPDATE entities SET image_url = ? WHERE id = ?').run(
        body.imageUrl,
        Number(entityId),
      )
    }

    return {
      success: true,
      imageId: result.lastInsertRowid,
      isPrimary: count.count === 0,
    }
  } catch (error) {
    console.error('[Add Generated Image] Error:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to add generated image',
    })
  }
})
