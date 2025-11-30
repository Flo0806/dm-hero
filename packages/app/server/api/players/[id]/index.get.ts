import { getDb } from '../../../utils/db'
import type { EntityTypeRow, EntityRow } from '../../../types/database'

export default defineEventHandler((event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Player ID is required',
    })
  }

  // Get Player entity type ID
  const entityType = db
    .prepare<[string], EntityTypeRow>('SELECT id FROM entity_types WHERE name = ?')
    .get('Player')

  if (!entityType) {
    throw createError({
      statusCode: 404,
      message: 'Player entity type not found',
    })
  }

  // Get the Player
  const player = db
    .prepare<[string, number], EntityRow>(
      `
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
  `,
    )
    .get(id, entityType.id)

  if (!player) {
    throw createError({
      statusCode: 404,
      message: 'Player not found',
    })
  }

  const metadata = player.metadata ? JSON.parse(player.metadata as string) : {}

  return {
    id: player.id,
    name: player.name,
    description: player.description,
    image_url: player.image_url,
    created_at: player.created_at,
    updated_at: player.updated_at,
    ...metadata,
  }
})
