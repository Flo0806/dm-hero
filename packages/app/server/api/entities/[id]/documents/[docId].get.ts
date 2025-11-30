import { getDb } from '../../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const entityId = getRouterParam(event, 'id')
  const docId = getRouterParam(event, 'docId')

  if (!entityId || !docId) {
    throw createError({
      statusCode: 400,
      message: 'Entity ID and Document ID are required',
    })
  }

  const document = db
    .prepare(
      `
    SELECT * FROM entity_documents
    WHERE id = ? AND entity_id = ?
  `,
    )
    .get(docId, entityId)

  if (!document) {
    throw createError({
      statusCode: 404,
      message: 'Document not found',
    })
  }

  return document
})
