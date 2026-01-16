import { getDb } from '../../../../utils/db'
import { createApiError, ErrorCodes } from '../../../../utils/errors'

export default defineEventHandler((event) => {
  const db = getDb()
  const groupId = Number(getRouterParam(event, 'id'))
  const entityId = Number(getRouterParam(event, 'entityId'))

  if (!groupId || isNaN(groupId)) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.INVALID_ID })
  }

  if (!entityId || isNaN(entityId)) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.GROUP_ENTITY_ID_REQUIRED })
  }

  const result = db.prepare('DELETE FROM entity_group_members WHERE group_id = ? AND entity_id = ?').run(groupId, entityId)

  return { success: true, removed: result.changes > 0 }
})
