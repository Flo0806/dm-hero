import { getDb } from '../../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const entityId = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!entityId) {
    throw createError({
      statusCode: 400,
      message: 'Entity ID is required',
    })
  }

  const { documentIds } = body

  if (!Array.isArray(documentIds)) {
    throw createError({
      statusCode: 400,
      message: 'documentIds must be an array',
    })
  }

  // Update sort_order for each document
  const updateStmt = db.prepare(`
    UPDATE entity_documents
    SET sort_order = ?
    WHERE id = ? AND entity_id = ?
  `)

  const updateMany = db.transaction((ids: number[]) => {
    ids.forEach((docId, index) => {
      updateStmt.run(index, docId, entityId)
    })
  })

  updateMany(documentIds)

  return { success: true }
})
