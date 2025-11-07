import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Relation ID is required',
    })
  }

  // Delete the relation
  db.prepare(
    `
    DELETE FROM entity_relations WHERE id = ?
  `,
  ).run(id)

  return { success: true }
})
