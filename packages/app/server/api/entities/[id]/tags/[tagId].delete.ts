import { getDb } from '../../../../utils/db'
import { createApiError, ErrorCodes } from '../../../../utils/errors'

export default defineEventHandler((event): { success: true } => {
  const entityId = Number(getRouterParam(event, 'id'))
  const tagId = Number(getRouterParam(event, 'tagId'))
  if (!Number.isFinite(entityId) || !Number.isFinite(tagId)) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'invalid id' })
  }

  const db = getDb()
  db.prepare('DELETE FROM entity_tags WHERE entity_id = ? AND tag_id = ?').run(entityId, tagId)

  return { success: true }
})
