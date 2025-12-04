import { getDb } from '../../../utils/db'
import type { EntityTypeRow, EntityRow } from '../../../types/database'

export default defineEventHandler((event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Faction ID is required',
    })
  }

  // Get Faction entity type ID
  const entityType = db
    .prepare<[string], EntityTypeRow>('SELECT id FROM entity_types WHERE name = ?')
    .get('Faction')

  if (!entityType) {
    throw createError({
      statusCode: 404,
      message: 'Faction entity type not found',
    })
  }

  // Get the faction with leader info
  interface FactionWithLeader extends EntityRow {
    leader_id: number | null
    leader_name: string | null
  }

  const faction = db
    .prepare<[string, number], FactionWithLeader>(
      `
    SELECT
      e.id,
      e.name,
      e.description,
      e.image_url,
      e.metadata,
      e.created_at,
      e.updated_at,
      leader_rel.from_entity_id as leader_id,
      leader_npc.name as leader_name
    FROM entities e
    LEFT JOIN entity_relations leader_rel ON leader_rel.to_entity_id = e.id AND leader_rel.relation_type = 'leader'
    LEFT JOIN entities leader_npc ON leader_npc.id = leader_rel.from_entity_id AND leader_npc.deleted_at IS NULL
    WHERE e.id = ?
      AND e.type_id = ?
      AND e.deleted_at IS NULL
  `,
    )
    .get(id, entityType.id)

  if (!faction) {
    throw createError({
      statusCode: 404,
      message: 'Faction not found',
    })
  }

  const metadata = faction.metadata ? JSON.parse(faction.metadata as string) : null

  return {
    id: faction.id,
    name: faction.name,
    description: faction.description,
    image_url: faction.image_url,
    created_at: faction.created_at,
    updated_at: faction.updated_at,
    metadata,
    leader_id: faction.leader_id,
    leader_name: faction.leader_name,
  }
})
