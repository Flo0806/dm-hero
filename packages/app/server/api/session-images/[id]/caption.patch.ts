import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const imageId = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!imageId) {
    throw createError({
      statusCode: 400,
      message: 'Image ID is required',
    })
  }

  const { caption } = body

  // Update caption
  const result = db
    .prepare(
      `
    UPDATE session_images
    SET caption = ?
    WHERE id = ?
  `,
    )
    .run(caption || null, imageId)

  if (result.changes === 0) {
    throw createError({
      statusCode: 404,
      message: 'Image not found',
    })
  }

  return { success: true }
})
