import { getDb } from '../../../utils/db'
import { createApiError, ErrorCodes } from '../../../utils/errors'
import type { GroupMember } from '~~/types/group'

interface MemberRow {
  entity_id: number
  entity_name: string
  entity_type: string
  entity_type_id: number
  entity_image_url: string | null
  added_at: string
}

export default defineEventHandler((event) => {
  const db = getDb()
  const groupId = Number(getRouterParam(event, 'id'))
  const query = getQuery(event)
  const entityType = query.entityType as string | undefined

  if (!groupId || isNaN(groupId)) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.INVALID_ID })
  }

  let sql = `
    SELECT
      gm.entity_id,
      e.name as entity_name,
      et.name as entity_type,
      et.id as entity_type_id,
      e.image_url as entity_image_url,
      gm.added_at
    FROM entity_group_members gm
    JOIN entities e ON e.id = gm.entity_id AND e.deleted_at IS NULL
    JOIN entity_types et ON et.id = e.type_id
    WHERE gm.group_id = ?
  `

  const params: (string | number)[] = [groupId]

  if (entityType) {
    sql += ' AND et.name = ?'
    params.push(entityType)
  }

  sql += ' ORDER BY et.name, e.name COLLATE NOCASE'

  const members = db.prepare(sql).all(...params) as MemberRow[]

  return members.map(
    (m): GroupMember => ({
      entity_id: m.entity_id,
      entity_name: m.entity_name,
      entity_type: m.entity_type,
      entity_type_id: m.entity_type_id,
      entity_image_url: m.entity_image_url,
      added_at: m.added_at,
    }),
  )
})
