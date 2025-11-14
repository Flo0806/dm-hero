import { getDb } from '../../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const entityId = getRouterParam(event, 'id')

  if (!entityId) {
    throw createError({
      statusCode: 400,
      message: 'Entity ID is required',
    })
  }

  const documents = db
    .prepare(
      `
    SELECT
      id,
      entity_id,
      title,
      content,
      date,
      sort_order,
      file_path,
      file_type,
      created_at,
      updated_at
    FROM entity_documents
    WHERE entity_id = ?
    ORDER BY sort_order ASC, created_at DESC
  `,
    )
    .all(entityId)

  return documents
})
