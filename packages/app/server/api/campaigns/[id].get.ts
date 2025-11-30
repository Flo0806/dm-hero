import { getDb } from '../../utils/db'

export default defineEventHandler((event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Campaign ID is required',
    })
  }

  // Get campaign by ID
  const campaign = db
    .prepare(
      `
    SELECT
      id,
      name,
      description,
      created_at,
      updated_at
    FROM campaigns
    WHERE id = ?
      AND deleted_at IS NULL
  `,
    )
    .get(id)

  if (!campaign) {
    throw createError({
      statusCode: 404,
      message: 'Campaign not found',
    })
  }

  return campaign
})
