import { getDb } from '../../../utils/db'
import { createApiError, ErrorCodes } from '../../../utils/errors'

export default defineEventHandler((event) => {
  const db = getDb()
  const groupId = Number(getRouterParam(event, 'id'))

  if (!groupId || isNaN(groupId)) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.INVALID_ID })
  }

  // Check group exists
  const existing = db.prepare('SELECT id FROM entity_groups WHERE id = ? AND deleted_at IS NULL').get(groupId)

  if (!existing) {
    throw createApiError({ statusCode: 404, code: ErrorCodes.GROUP_NOT_FOUND })
  }

  // Soft-delete the group
  db.prepare("UPDATE entity_groups SET deleted_at = datetime('now') WHERE id = ?").run(groupId)

  return { success: true }
})
