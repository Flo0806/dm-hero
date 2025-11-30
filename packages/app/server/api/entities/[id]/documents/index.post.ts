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

  const { title, content, date } = body

  if (!title || !date) {
    throw createError({
      statusCode: 400,
      message: 'Title and date are required',
    })
  }

  // Get the highest sort_order for this entity
  const maxSortOrder = db
    .prepare(
      `
    SELECT COALESCE(MAX(sort_order), -1) as max_order
    FROM entity_documents
    WHERE entity_id = ?
  `,
    )
    .get(entityId) as { max_order: number }

  // Create document
  const result = db
    .prepare(
      `
    INSERT INTO entity_documents (entity_id, title, content, date, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `,
    )
    .run(entityId, title, content || '', date, maxSortOrder.max_order + 1)

  const documentId = result.lastInsertRowid

  // Return created document
  const document = db
    .prepare(
      `
    SELECT * FROM entity_documents WHERE id = ?
  `,
    )
    .get(documentId)

  return document
})
