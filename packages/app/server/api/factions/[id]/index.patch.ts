import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Faction ID is required',
    })
  }

  const { name, description, metadata, leader_id } = body as {
    name?: string
    description?: string
    metadata?: Record<string, string | number | boolean | null>
    leader_id?: number | null
  }

  // Update basic entity fields
  db.prepare(
    `
    UPDATE entities
    SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      metadata = COALESCE(?, metadata),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND deleted_at IS NULL
  `,
  ).run(name, description, metadata ? JSON.stringify(metadata) : null, id)

  // Handle leader relation (stored as entity_relation with type 'leader')
  if (leader_id !== undefined) {
    // First, remove existing leader relation
    db.prepare(
      'DELETE FROM entity_relations WHERE to_entity_id = ? AND relation_type = \'leader\'',
    ).run(id)

    // If a new leader is set, create the relation
    if (leader_id !== null) {
      db.prepare(
        `INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type, created_at)
         VALUES (?, ?, 'leader', CURRENT_TIMESTAMP)`,
      ).run(leader_id, id)
    }
  }

  // Fetch updated faction with leader info
  interface DbFaction {
    id: number
    type_id: number
    campaign_id: number
    name: string
    description: string | null
    image_url: string | null
    metadata: string | null
    created_at: string
    updated_at: string
    deleted_at: string | null
    leader_id: number | null
    leader_name: string | null
  }

  const faction = db
    .prepare<unknown[], DbFaction>(
      `
    SELECT e.*,
           leader_rel.from_entity_id as leader_id,
           leader_npc.name as leader_name
    FROM entities e
    LEFT JOIN entity_relations leader_rel ON leader_rel.to_entity_id = e.id AND leader_rel.relation_type = 'leader'
    LEFT JOIN entities leader_npc ON leader_npc.id = leader_rel.from_entity_id AND leader_npc.deleted_at IS NULL
    WHERE e.id = ? AND e.deleted_at IS NULL
  `,
    )
    .get(id)

  if (!faction) {
    throw createError({
      statusCode: 404,
      message: 'Faction not found',
    })
  }

  return {
    id: faction.id,
    name: faction.name,
    description: faction.description,
    image_url: faction.image_url,
    created_at: faction.created_at,
    updated_at: faction.updated_at,
    metadata: faction.metadata ? JSON.parse(faction.metadata) : null,
    leader_id: faction.leader_id,
    leader_name: faction.leader_name,
  }
})
