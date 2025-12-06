import { getDb } from '../../../utils/db'

export default defineEventHandler((event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'NPC ID is required',
    })
  }

  // Get the NPC entity type ID
  const npcTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'NPC'").get() as
    | { id: number }
    | undefined

  // Find all NPCs that have relations to this NPC (before we delete)
  // These NPCs will need their relation counts updated in the frontend
  const affectedNpcIds: number[] = []

  if (npcTypeId) {
    const affected = db
      .prepare<unknown[], { npc_id: number }>(
        `
        SELECT DISTINCT
          CASE
            WHEN er.from_entity_id = ? THEN er.to_entity_id
            ELSE er.from_entity_id
          END as npc_id
        FROM entity_relations er
        INNER JOIN entities e ON (
          CASE
            WHEN er.from_entity_id = ? THEN er.to_entity_id
            ELSE er.from_entity_id
          END = e.id
        )
        WHERE (er.from_entity_id = ? OR er.to_entity_id = ?)
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      `,
      )
      .all(id, id, id, id, npcTypeId.id)

    for (const row of affected) {
      affectedNpcIds.push(row.npc_id)
    }
  }

  // Soft-delete: set deleted_at timestamp
  db.prepare(
    `
    UPDATE entities
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE id = ? AND deleted_at IS NULL
  `,
  ).run(id)

  return {
    success: true,
    affectedNpcIds,
  }
})
