import { getDb } from '../../utils/db'
import { createApiError, ErrorCodes } from '../../utils/errors'
import type { GroupCounts } from '~~/types/group'

interface CountRow {
  group_id: number
  entity_type: string
  count: number
}

export default defineEventHandler((event) => {
  const db = getDb()
  const query = getQuery(event)
  const idsParam = query.ids as string | undefined

  if (!idsParam) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.INVALID_ID })
  }

  const ids = idsParam.split(',').map(Number).filter(Boolean)

  if (ids.length === 0) {
    return {}
  }

  const placeholders = ids.map(() => '?').join(',')

  const counts = db
    .prepare(
      `
      SELECT gm.group_id, et.name as entity_type, COUNT(*) as count
      FROM entity_group_members gm
      JOIN entities e ON e.id = gm.entity_id AND e.deleted_at IS NULL
      JOIN entity_types et ON et.id = e.type_id
      WHERE gm.group_id IN (${placeholders})
      GROUP BY gm.group_id, et.name
    `,
    )
    .all(...ids) as CountRow[]

  // Build result map
  const result: Record<number, GroupCounts> = {}

  for (const id of ids) {
    result[id] = { total: 0, byType: {} }
  }

  for (const row of counts) {
    if (!result[row.group_id]) {
      result[row.group_id] = { total: 0, byType: {} }
    }
    result[row.group_id].byType[row.entity_type] = row.count
    result[row.group_id].total += row.count
  }

  return result
})
