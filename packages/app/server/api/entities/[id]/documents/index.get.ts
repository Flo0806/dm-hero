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

  const query = getQuery(event)
  const documentType = query.document_type as string | undefined
  const excludeType = query.exclude_type as string | undefined

  let sql = `
    SELECT id, entity_id, title, content, date, sort_order,
           file_path, file_type, document_type, created_at, updated_at
    FROM entity_documents
    WHERE entity_id = ?`
  const params: unknown[] = [entityId]

  if (documentType) {
    sql += ' AND document_type = ?'
    params.push(documentType)
  }
  else if (excludeType) {
    sql += ' AND (document_type IS NULL OR document_type != ?)'
    params.push(excludeType)
  }

  sql += ' ORDER BY sort_order ASC, created_at DESC'

  const documents = db.prepare(sql).all(...params)

  return documents
})
