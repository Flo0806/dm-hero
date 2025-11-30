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

  // Verify document exists and belongs to entity
  const document = db
    .prepare(
      `
    SELECT id FROM entity_documents
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

  // Delete document
  db.prepare(
    `
    DELETE FROM entity_documents
    WHERE id = ? AND entity_id = ?
  `,
  ).run(docId, entityId)

  return { success: true }
})
