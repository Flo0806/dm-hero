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

  // Get entity IDs that will be deleted (needed for cascade cleanup)
  const entityIds = db
    .prepare('SELECT entity_id FROM entity_group_members WHERE group_id = ?')
    .all(groupId) as Array<{ entity_id: number }>
  const entityIdList = entityIds.map((e) => e.entity_id)

  if (entityIdList.length > 0) {
    const placeholders = entityIdList.map(() => '?').join(',')

    // Delete map markers for these entities
    db.prepare(`DELETE FROM map_markers WHERE entity_id IN (${placeholders})`).run(...entityIdList)

    // Delete map areas (for location entities)
    db.prepare(`DELETE FROM map_areas WHERE location_id IN (${placeholders})`).run(...entityIdList)

    // Delete calendar events linked to these entities
    db.prepare(`DELETE FROM calendar_event_entities WHERE entity_id IN (${placeholders})`).run(...entityIdList)

    // Delete calendar events where entity_id matches (legacy single-entity link)
    db.prepare(`DELETE FROM calendar_events WHERE entity_id IN (${placeholders})`).run(...entityIdList)

    // Delete pinboard entries
    db.prepare(`DELETE FROM pinboard WHERE entity_id IN (${placeholders})`).run(...entityIdList)

    // Delete entity relations (both directions)
    db.prepare(`DELETE FROM entity_relations WHERE from_entity_id IN (${placeholders}) OR to_entity_id IN (${placeholders})`).run(...entityIdList, ...entityIdList)

    // Soft-delete all entities in group
    db.prepare(`
      UPDATE entities SET deleted_at = datetime('now')
      WHERE id IN (${placeholders})
      AND deleted_at IS NULL
    `).run(...entityIdList)
  }

  // Soft-delete the group itself
  db.prepare("UPDATE entity_groups SET deleted_at = datetime('now') WHERE id = ?").run(groupId)

  return {
    success: true,
    deletedEntities: entityIdList.length,
    groupDeleted: true,
  }
})
