import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const npcId = getRouterParam(event, 'id')
  const query = getQuery(event)
  const search = query.search as string | undefined

  if (!npcId) {
    throw createError({
      statusCode: 400,
      message: 'NPC ID is required',
    })
  }

  let sql = `
    SELECT
      s.id,
      s.title,
      s.summary,
      s.date,
      s.notes,
      s.created_at,
      s.updated_at
    FROM sessions s
    INNER JOIN session_mentions sm ON s.id = sm.session_id
    WHERE sm.entity_id = ?
      AND s.deleted_at IS NULL
  `

  const params: (string | number)[] = [npcId]

  // Add search filter if provided
  if (search) {
    sql += ' AND (s.title LIKE ? OR s.summary LIKE ? OR s.notes LIKE ?)'
    const searchPattern = `%${search}%`
    params.push(searchPattern, searchPattern, searchPattern)
  }

  sql += ' ORDER BY s.date DESC, s.created_at DESC'

  const notes = db.prepare(sql).all(...params)

  return notes
})
