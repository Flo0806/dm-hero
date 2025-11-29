import { getDb } from '../../../utils/db'
import type { LoreMetadata } from '~~/types/lore'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Lore ID is required',
    })
  }

  const { name, description, metadata } = body as {
    name?: string
    description?: string
    metadata?: LoreMetadata
  }

  // Build dynamic SQL based on provided fields
  const updates: string[] = []
  const values: (string | null | number)[] = []

  if (name !== undefined) {
    updates.push('name = ?')
    values.push(name)
  }

  if (description !== undefined) {
    updates.push('description = ?')
    values.push(description)
  }

  // Lore metadata doesn't need conversion (type and date are already keys)
  if (metadata !== undefined) {
    updates.push('metadata = ?')
    values.push(metadata ? JSON.stringify(metadata) : null)
  }

  updates.push('updated_at = CURRENT_TIMESTAMP')
  values.push(id)

  db.prepare(
    `
    UPDATE entities
    SET ${updates.join(', ')}
    WHERE id = ? AND deleted_at IS NULL
  `,
  ).run(...values)

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

  const lore = db
    .prepare<unknown[], DbEntity>(
      `
    SELECT * FROM entities WHERE id = ? AND deleted_at IS NULL
  `,
    )
    .get(id)

  if (!lore) {
    throw createError({
      statusCode: 404,
      message: 'Lore entry not found',
    })
  }

  return {
    ...lore,
    metadata: lore.metadata ? JSON.parse(lore.metadata) : null,
  }
})
