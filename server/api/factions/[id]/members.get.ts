import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const factionId = getRouterParam(event, 'id')

  if (!factionId) {
    throw createError({
      statusCode: 400,
      message: 'Faction ID is required',
    })
  }

  interface DbMember {
    id: number
    from_entity_id: number
    to_entity_id: number
    relation_type: string
    notes: string | null
    created_at: string
    npc_name: string
  }

  // Get all NPCs that have a relation TO this faction
  const members = db
    .prepare<unknown[], DbMember>(
      `
    SELECT
      er.id,
      er.from_entity_id,
      er.to_entity_id,
      er.relation_type,
      er.notes,
      er.created_at,
      e.name as npc_name
    FROM entity_relations er
    INNER JOIN entities e ON er.from_entity_id = e.id
    WHERE er.to_entity_id = ?
      AND e.deleted_at IS NULL
    ORDER BY e.name ASC
  `,
    )
    .all(factionId)

  return members.map((member) => ({
    ...member,
    notes: member.notes ? JSON.parse(member.notes) : null,
  }))
})
