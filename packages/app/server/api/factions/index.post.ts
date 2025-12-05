import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody(event)

  const { name, description, metadata, campaignId, leader_id, location_id } = body as {
    name: string
    description?: string
    metadata?: Record<string, string | number | boolean | null>
    campaignId: number
    leader_id?: number | null
    location_id?: number | null
  }

  if (!name || !campaignId) {
    throw createError({
      statusCode: 400,
      message: 'Name and Campaign ID are required',
    })
  }

  // Get Faction entity type ID
  const entityType = db
    .prepare<unknown[], { id: number }>('SELECT id FROM entity_types WHERE name = ?')
    .get('Faction')

  if (!entityType) {
    throw createError({
      statusCode: 500,
      message: 'Faction entity type not found',
    })
  }

  const result = db
    .prepare(
      `
    INSERT INTO entities (type_id, campaign_id, name, description, location_id, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      entityType.id,
      campaignId,
      name,
      description || null,
      location_id ?? null,
      metadata ? JSON.stringify(metadata) : null,
    )

  const factionId = result.lastInsertRowid

  // Create leader relation if leader_id is provided
  if (leader_id) {
    db.prepare(
      `INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type, created_at)
       VALUES (?, ?, 'leader', CURRENT_TIMESTAMP)`,
    ).run(leader_id, factionId)
  }

  // Fetch created faction with leader info
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
    WHERE e.id = ?
  `,
    )
    .get(factionId)

  if (!faction) {
    throw createError({
      statusCode: 500,
      message: 'Failed to create faction',
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
