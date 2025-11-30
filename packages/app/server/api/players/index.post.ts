import { getDb } from '../../utils/db'
import type { PlayerMetadata } from '../../../types/player'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody(event)

  const { name, description, metadata, campaignId } = body as {
    name: string
    description?: string
    metadata?: PlayerMetadata
    campaignId: number
  }

  if (!name || !campaignId) {
    throw createError({
      statusCode: 400,
      message: 'Name and Campaign ID are required',
    })
  }

  // Get Player entity type ID
  const entityType = db
    .prepare<unknown[], { id: number }>('SELECT id FROM entity_types WHERE name = ?')
    .get('Player')

  if (!entityType) {
    throw createError({
      statusCode: 500,
      message: 'Player entity type not found',
    })
  }

  const result = db
    .prepare(
      `
    INSERT INTO entities (type_id, campaign_id, name, description, metadata)
    VALUES (?, ?, ?, ?, ?)
  `,
    )
    .run(
      entityType.id,
      campaignId,
      name,
      description || null,
      metadata ? JSON.stringify(metadata) : null,
    )

  interface DbEntity {
    id: number
    type_id: number
    campaign_id: number
    name: string
    description: string | null
    metadata: string | null
    created_at: string
    updated_at: string
    deleted_at: string | null
  }

  const player = db
    .prepare<unknown[], DbEntity>(
      `
    SELECT * FROM entities WHERE id = ?
  `,
    )
    .get(result.lastInsertRowid)

  if (!player) {
    throw createError({
      statusCode: 500,
      message: 'Failed to create player',
    })
  }

  return {
    ...player,
    metadata: player.metadata ? (JSON.parse(player.metadata) as PlayerMetadata) : null,
  }
})
