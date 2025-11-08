import { getDb } from '../../utils/db'
import { convertMetadataToKeys } from '../../utils/i18n-lookup'
import type { NpcMetadata } from '../../../types/npc'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'NPC ID is required',
    })
  }

  const { name, description, metadata } = body as {
    name?: string
    description?: string
    metadata?: NpcMetadata
  }

  // Convert localized race/class names to keys before saving
  const metadataWithKeys = metadata
    ? await convertMetadataToKeys(metadata as Record<string, unknown>, 'npc')
    : null

  // Build UPDATE dynamically - only update fields that are provided
  const updates: string[] = []
  const values: unknown[] = []

  if (name !== undefined) {
    updates.push('name = ?')
    values.push(name)
  }
  if (description !== undefined) {
    updates.push('description = ?')
    values.push(description)
  }
  if (metadata !== undefined) {
    updates.push('metadata = ?')
    values.push(metadataWithKeys ? JSON.stringify(metadataWithKeys) : null)
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP')
    values.push(id)

    db.prepare(
      `
      UPDATE entities
      SET ${updates.join(', ')}
      WHERE id = ? AND deleted_at IS NULL
    `,
    ).run(...values)
  }

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

  const npc = db
    .prepare<unknown[], DbEntity>(
      `
    SELECT * FROM entities WHERE id = ? AND deleted_at IS NULL
  `,
    )
    .get(id)

  if (!npc) {
    throw createError({
      statusCode: 404,
      message: 'NPC not found',
    })
  }

  return {
    ...npc,
    metadata: npc.metadata ? JSON.parse(npc.metadata) : null,
  }
})
