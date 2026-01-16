import { getDb } from '../../../utils/db'
import { createApiError, ErrorCodes } from '../../../utils/errors'

interface DeleteAllBody {
  confirmed?: boolean
}

interface GroupRow {
  id: number
  name: string
}

export default defineEventHandler(async (event) => {
  const db = getDb()
  const groupId = Number(getRouterParam(event, 'id'))
  const body: DeleteAllBody = await readBody<DeleteAllBody>(event).catch(() => ({})) || {}

  if (!groupId || isNaN(groupId)) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.INVALID_ID })
  }

  const group = db.prepare('SELECT id, name FROM entity_groups WHERE id = ? AND deleted_at IS NULL').get(groupId) as
    | GroupRow
    | undefined

  if (!group) {
    throw createApiError({ statusCode: 404, code: ErrorCodes.GROUP_NOT_FOUND })
  }

  // Get count of entities in group
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

  // If not confirmed, return info for confirmation dialog
  if (!body.confirmed) {
    return {
      requiresConfirmation: true,
      groupName: group.name,
      entityCount: countResult.count,
    }
  }

  // Soft-delete all entities in group
  const deleteEntities = db.prepare(`
    UPDATE entities SET deleted_at = datetime('now')
    WHERE id IN (SELECT entity_id FROM entity_group_members WHERE group_id = ?)
    AND deleted_at IS NULL
  `)
  const entitiesResult = deleteEntities.run(groupId)

  // Soft-delete the group itself
  db.prepare("UPDATE entity_groups SET deleted_at = datetime('now') WHERE id = ?").run(groupId)

  return {
    success: true,
    deletedEntities: entitiesResult.changes,
    groupDeleted: true,
  }
})
