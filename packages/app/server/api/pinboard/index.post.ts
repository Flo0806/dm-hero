import { getDb } from '~~/server/utils/db'
import type { AddPinRequest, AddPinResponse } from '~~/types/pinboard'

interface EntityRow {
  id: number
}

interface MaxOrderRow {
  max_order: number | null
}

export default defineEventHandler(async (event): Promise<AddPinResponse> => {
  const body = await readBody<AddPinRequest>(event)

  if (!body.campaignId) {
    throw createError({ statusCode: 400, message: 'Campaign ID is required' })
  }

  if (!body.entityId) {
    throw createError({ statusCode: 400, message: 'Entity ID is required' })
  }

  const db = getDb()

  // Check if entity exists
  const entity = db
    .prepare('SELECT id FROM entities WHERE id = ? AND deleted_at IS NULL')
    .get(body.entityId) as EntityRow | undefined

  if (!entity) {
    throw createError({ statusCode: 404, message: 'Entity not found' })
  }

  // Get the next display order
  const maxOrder = db
    .prepare('SELECT MAX(display_order) as max_order FROM pinboard WHERE campaign_id = ?')
    .get(body.campaignId) as MaxOrderRow | undefined

  const displayOrder = (maxOrder?.max_order ?? -1) + 1

  try {
    // Insert the pin (UNIQUE constraint will prevent duplicates)
    const result = db
      .prepare(
        `
        INSERT INTO pinboard (campaign_id, entity_id, display_order)
        VALUES (?, ?, ?)
      `,
      )
      .run(body.campaignId, body.entityId, displayOrder)

    return {
      success: true,
      pinId: result.lastInsertRowid,
      displayOrder,
    }
  } catch (error: unknown) {
    // Handle duplicate pin attempt
    if (error instanceof Error && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw createError({ statusCode: 409, message: 'Entity is already pinned' })
    }
    throw error
  }
})
