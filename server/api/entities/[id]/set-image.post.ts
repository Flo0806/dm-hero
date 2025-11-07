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
