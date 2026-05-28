import { getDb } from '../../utils/db'
import { createApiError, ErrorCodes } from '../../utils/errors'

export default defineEventHandler((event): { success: true } => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'invalid id' })
  }

  const db = getDb()
  // Soft-delete the tag; entity_tags rows stay so existing entities keep their tag
  // until the user explicitly purges or the tag is revived.
  db.prepare('UPDATE tags SET deleted_at = datetime(\'now\') WHERE id = ?').run(id)

  return { success: true }
})
