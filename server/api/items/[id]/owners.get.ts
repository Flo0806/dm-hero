import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const itemId = getRouterParam(event, 'id')

  if (!itemId) {
    throw createError({
      statusCode: 400,
      message: 'Item ID is required',
    })
  }

  interface DbOwner {
    id: number
    from_entity_id: number
    to_entity_id: number
    relation_type: string
    notes: string | null
    created_at: string
    npc_name: string
  }

  // Get all NPCs that have a relation TO this item
  const owners = db.prepare<unknown[], DbOwner>(`
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
  `).all(itemId)

  return owners.map(owner => ({
    ...owner,
    notes: owner.notes ? JSON.parse(owner.notes) : null,
  }))
})
