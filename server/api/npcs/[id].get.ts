import { getDb } from '../../utils/db'

export default defineEventHandler((event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'NPC ID is required',
    })
  }

  // Get NPC entity type ID
  const entityType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as { id: number } | undefined

  if (!entityType) {
    throw createError({
      statusCode: 404,
      message: 'NPC entity type not found',
    })
  }

  // Get the NPC
  const npc = db.prepare(`
    SELECT
      e.id,
      e.name,
      e.description,
      e.image_url,
      e.metadata,
      e.created_at,
      e.updated_at
    FROM entities e
    WHERE e.id = ?
      AND e.type_id = ?
      AND e.deleted_at IS NULL
  `).get(id, entityType.id)

  if (!npc) {
    throw createError({
      statusCode: 404,
      message: 'NPC not found',
    })
  }

  const metadata = npc.metadata ? JSON.parse(npc.metadata as string) : {}

  return {
    id: npc.id,
    name: npc.name,
    description: npc.description,
    image_url: npc.image_url,
    created_at: npc.created_at,
    updated_at: npc.updated_at,
    ...metadata,
  }
})
