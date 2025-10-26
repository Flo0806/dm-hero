import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Campaign ID is required',
    })
  }

  const { name, description } = body

  db.prepare(`
    UPDATE campaigns
    SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND deleted_at IS NULL
  `).run(name, description, id)

  const campaign = db.prepare(`
    SELECT * FROM campaigns WHERE id = ? AND deleted_at IS NULL
  `).get(id)

  if (!campaign) {
    throw createError({
      statusCode: 404,
      message: 'Campaign not found',
    })
  }

  return campaign
})
