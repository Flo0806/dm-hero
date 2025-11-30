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

  const body = await readBody(event)
  const caption = body.caption

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

  // Update caption
  db.prepare('UPDATE entity_images SET caption = ? WHERE id = ?').run(caption || null, imageId)

  // Update entity's updated_at
  db.prepare('UPDATE entities SET updated_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    image.entity_id,
  )

  return {
    success: true,
  }
})
