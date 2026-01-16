import { getDb } from '../../../utils/db'
import { createApiError, ErrorCodes } from '../../../utils/errors'
import type { EntityGroup, GroupCounts } from '~~/types/group'

interface GroupRow {
  id: number
  campaign_id: number
  name: string
  description: string | null
  color: string | null
  icon: string | null
  created_at: string
  updated_at: string
}

interface CountRow {
  entity_type: string
  count: number
}

export default defineEventHandler((event) => {
  const db = getDb()
  const groupId = Number(getRouterParam(event, 'id'))

  if (!groupId || isNaN(groupId)) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.INVALID_ID })
  }

  const group = db
    .prepare(
      `
      SELECT * FROM entity_groups WHERE id = ? AND deleted_at IS NULL
    `,
    )
    .get(groupId) as GroupRow | undefined

  if (!group) {
    throw createApiError({ statusCode: 404, code: ErrorCodes.GROUP_NOT_FOUND })
  }

  // Get counts by entity type
  const counts = db
    .prepare(
      `
      SELECT et.name as entity_type, COUNT(*) as count
      FROM entity_group_members gm
      JOIN entities e ON e.id = gm.entity_id AND e.deleted_at IS NULL
      JOIN entity_types et ON et.id = e.type_id
      WHERE gm.group_id = ?
      GROUP BY et.name
    `,
    )
    .all(groupId) as CountRow[]

  const byType: Record<string, number> = {}
  let total = 0

  for (const row of counts) {
    byType[row.entity_type] = row.count
    total += row.count
  }

  const groupCounts: GroupCounts = { total, byType }

  return {
    ...group,
    _counts: groupCounts,
  } as EntityGroup
})
