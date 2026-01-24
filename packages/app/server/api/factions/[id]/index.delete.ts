import { getDb } from '../../../utils/db'

export default defineEventHandler((event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Faction ID is required',
    })
  }

  // Get the Faction entity type ID
  const factionTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'Faction'").get() as
    | { id: number }
    | undefined

  // Find all Factions that have relations to this Faction (before we delete)
  // These Factions will need their relation counts updated in the frontend
  const affectedFactionIds: number[] = []

  if (factionTypeId) {
    const affected = db
      .prepare<unknown[], { faction_id: number }>(
        `
        SELECT DISTINCT
          CASE
            WHEN er.from_entity_id = ? THEN er.to_entity_id
            ELSE er.from_entity_id
          END as faction_id
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
      .all(id, id, id, id, factionTypeId.id)

    for (const row of affected) {
      affectedFactionIds.push(row.faction_id)
    }
  }

  // Soft-delete the faction
  db.prepare(
    `
    UPDATE entities
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE id = ? AND deleted_at IS NULL
  `,
  ).run(id)

  return {
    success: true,
    affectedFactionIds,
  }
})
