import { getDb } from '../../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const entityId = getRouterParam(event, 'id')
  const docId = getRouterParam(event, 'docId')
  const body = await readBody(event)

  if (!entityId || !docId) {
    throw createError({
      statusCode: 400,
      message: 'Entity ID and Document ID are required',
    })
  }

  const { title, content, date, sort_order } = body

  // Build dynamic update query
  const updates: string[] = []
  const params: unknown[] = []

  if (title !== undefined) {
    updates.push('title = ?')
    params.push(title)
  }

  if (content !== undefined) {
    updates.push('content = ?')
    params.push(content)
  }

  if (date !== undefined) {
    updates.push('date = ?')
    params.push(date)
  }

  if (sort_order !== undefined) {
    updates.push('sort_order = ?')
    params.push(sort_order)
  }

  if (updates.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No fields to update',
    })
  }

  updates.push('updated_at = CURRENT_TIMESTAMP')
  params.push(docId, entityId)

  db.prepare(
    `
    UPDATE entity_documents
    SET ${updates.join(', ')}
    WHERE id = ? AND entity_id = ?
  `,
  ).run(...params)

  // Return updated document
  const document = db
    .prepare(
      `
    SELECT * FROM entity_documents WHERE id = ?
  `,
    )
    .get(docId)

  return document
})
