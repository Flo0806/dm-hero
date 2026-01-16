import { getDb } from '../../../utils/db'
import { createApiError, ErrorCodes } from '../../../utils/errors'
import type { EntityGroup } from '~~/types/group'

interface UpdateGroupBody {
  name?: string
  description?: string | null
  color?: string | null
  icon?: string | null
}

export default defineEventHandler(async (event) => {
  const db = getDb()
  const groupId = Number(getRouterParam(event, 'id'))
  const body = await readBody<UpdateGroupBody>(event)

  if (!groupId || isNaN(groupId)) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.INVALID_ID })
  }

  // Check group exists
  const existing = db.prepare('SELECT id FROM entity_groups WHERE id = ? AND deleted_at IS NULL').get(groupId)

  if (!existing) {
    throw createApiError({ statusCode: 404, code: ErrorCodes.GROUP_NOT_FOUND })
  }

  // Build update query dynamically
  const updates: string[] = []
  const params: (string | number | null)[] = []

  if (body.name !== undefined) {
    if (!body.name?.trim()) {
      throw createApiError({ statusCode: 400, code: ErrorCodes.GROUP_NAME_EMPTY })
    }
    updates.push('name = ?')
    params.push(body.name.trim())
  }

  if (body.description !== undefined) {
    updates.push('description = ?')
    params.push(body.description?.trim() || null)
  }

  if (body.color !== undefined) {
    updates.push('color = ?')
    params.push(body.color || null)
  }

  if (body.icon !== undefined) {
    updates.push('icon = ?')
    params.push(body.icon || null)
  }

  if (updates.length === 0) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.NO_FIELDS_TO_UPDATE })
  }

  updates.push("updated_at = datetime('now')")
  params.push(groupId)

  db.prepare(`UPDATE entity_groups SET ${updates.join(', ')} WHERE id = ?`).run(...params)

  // Return updated group with counts
  const group = db.prepare('SELECT * FROM entity_groups WHERE id = ?').get(groupId) as EntityGroup

  const countResult = db
    .prepare(
      `
      SELECT COUNT(*) as count
      FROM entity_group_members gm
      JOIN entities e ON e.id = gm.entity_id AND e.deleted_at IS NULL
      WHERE gm.group_id = ?
    `,
    )
    .get(groupId) as { count: number }

  return {
    ...group,
    _counts: { total: countResult.count, byType: {} },
  }
})
