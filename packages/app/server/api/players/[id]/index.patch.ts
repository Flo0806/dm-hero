import { getDb } from '../../../utils/db'
import type { PlayerMetadata } from '~~/types/player'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  const { name, description, location_id, metadata } = body as {
    name?: string
    description?: string | null
    location_id?: number | null
    metadata?: PlayerMetadata
  }

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Player ID is required',
    })
  }

  // Build update query dynamically
  const updates: string[] = []
  const values: (string | number | null)[] = []

  if (name !== undefined) {
    updates.push('name = ?')
    values.push(name)
  }

  if (description !== undefined) {
    updates.push('description = ?')
    values.push(description)
  }

  if (location_id !== undefined) {
    updates.push('location_id = ?')
    values.push(location_id)
  }

  if (metadata !== undefined) {
    updates.push('metadata = ?')
    values.push(JSON.stringify(metadata))
  }

  if (updates.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No fields to update',
    })
  }

  updates.push('updated_at = CURRENT_TIMESTAMP')
  values.push(id)

  db.prepare(
    `
    UPDATE entities
    SET ${updates.join(', ')}
    WHERE id = ?
  `,
  ).run(...values)

  interface DbEntity {
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
  }

  const player = db
    .prepare<unknown[], DbEntity>(
      `
    SELECT e.*, ei.image_url
    FROM entities e
    LEFT JOIN (
      SELECT entity_id, image_url
      FROM entity_images
      WHERE is_primary = 1
    ) ei ON ei.entity_id = e.id
    WHERE e.id = ?
  `,
    )
    .get(id)

  if (!player) {
    throw createError({
      statusCode: 404,
      message: 'Player not found',
    })
  }

  return {
    ...player,
    metadata: player.metadata ? (JSON.parse(player.metadata) as PlayerMetadata) : null,
  }
})
