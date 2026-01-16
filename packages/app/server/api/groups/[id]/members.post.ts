import { getDb } from '../../../utils/db'
import { createApiError, ErrorCodes } from '../../../utils/errors'

interface AddMembersBody {
  entityIds: number[]
}

export default defineEventHandler(async (event) => {
  const db = getDb()
  const groupId = Number(getRouterParam(event, 'id'))
  const body = await readBody<AddMembersBody>(event)

  if (!groupId || isNaN(groupId)) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.INVALID_ID })
  }

  if (!body.entityIds || !Array.isArray(body.entityIds) || body.entityIds.length === 0) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.GROUP_ENTITY_IDS_REQUIRED })
  }

  // Check group exists
  const existing = db.prepare('SELECT id FROM entity_groups WHERE id = ? AND deleted_at IS NULL').get(groupId)

  if (!existing) {
    throw createApiError({ statusCode: 404, code: ErrorCodes.GROUP_NOT_FOUND })
  }

  // Add members (ignore duplicates)
  const insert = db.prepare(`
    INSERT OR IGNORE INTO entity_group_members (group_id, entity_id)
    VALUES (?, ?)
  `)

  let added = 0
  for (const entityId of body.entityIds) {
    const result = insert.run(groupId, entityId)
    if (result.changes > 0) {
      added++
    }
  }

  return { success: true, added }
})
