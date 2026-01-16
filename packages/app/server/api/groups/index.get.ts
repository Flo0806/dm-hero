import { getDb } from '../../utils/db'
import { createApiError, ErrorCodes } from '../../utils/errors'
import type { EntityGroup } from '~~/types/group'

interface GroupRow {
  id: number
  campaign_id: number
  name: string
  description: string | null
  color: string | null
  icon: string | null
  created_at: string
  updated_at: string
  member_count: number
}

export default defineEventHandler((event) => {
  const db = getDb()
  const query = getQuery(event)
  const campaignId = query.campaignId as string
  const search = query.search as string | undefined

  if (!campaignId) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.CAMPAIGN_ID_REQUIRED })
  }

  let sql = `
    SELECT g.*,
           COUNT(DISTINCT CASE WHEN e.deleted_at IS NULL THEN gm.entity_id END) as member_count
    FROM entity_groups g
    LEFT JOIN entity_group_members gm ON gm.group_id = g.id
    LEFT JOIN entities e ON e.id = gm.entity_id
    WHERE g.campaign_id = ? AND g.deleted_at IS NULL
  `

  const params: (string | number)[] = [campaignId]

  if (search && search.trim()) {
    sql += ' AND (g.name LIKE ? OR g.description LIKE ?)'
    const searchPattern = `%${search.trim()}%`
    params.push(searchPattern, searchPattern)
  }

  sql += ' GROUP BY g.id ORDER BY g.name COLLATE NOCASE'

  const groups = db.prepare(sql).all(...params) as GroupRow[]

  return groups.map((g): EntityGroup => ({
    id: g.id,
    campaign_id: g.campaign_id,
    name: g.name,
    description: g.description,
    color: g.color,
    icon: g.icon,
    created_at: g.created_at,
    updated_at: g.updated_at,
    _counts: {
      total: g.member_count,
      byType: {},
    },
  }))
})
