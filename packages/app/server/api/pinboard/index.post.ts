import { getDb } from '~~/server/utils/db'
import type { AddPinRequest, AddPinResponse } from '~~/types/pinboard'

interface EntityRow {
  id: number
}

interface GroupRow {
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

  if (!body.entityId && !body.groupId) {
    throw createError({ statusCode: 400, message: 'Entity ID or Group ID is required' })
  }

  if (body.entityId && body.groupId) {
    throw createError({ statusCode: 400, message: 'Only one of Entity ID or Group ID can be provided' })
  }

  const db = getDb()

  if (body.entityId) {
    // Check if entity exists
    const entity = db
      .prepare('SELECT id FROM entities WHERE id = ? AND deleted_at IS NULL')
      .get(body.entityId) as EntityRow | undefined

    if (!entity) {
      throw createError({ statusCode: 404, message: 'Entity not found' })
    }
  }

  if (body.groupId) {
    // Check if group exists
    const group = db
      .prepare('SELECT id FROM entity_groups WHERE id = ? AND deleted_at IS NULL')
      .get(body.groupId) as GroupRow | undefined

    if (!group) {
      throw createError({ statusCode: 404, message: 'Group not found' })
    }
  }

  // Get the next display order
  const maxOrder = db
    .prepare('SELECT MAX(display_order) as max_order FROM pinboard WHERE campaign_id = ?')
    .get(body.campaignId) as MaxOrderRow | undefined

  const displayOrder = (maxOrder?.max_order ?? -1) + 1

  try {
    // Insert the pin
    const result = db
      .prepare(
        `
        INSERT INTO pinboard (campaign_id, entity_id, group_id, display_order)
        VALUES (?, ?, ?, ?)
      `,
      )
      .run(body.campaignId, body.entityId || null, body.groupId || null, displayOrder)

    return {
      success: true,
      pinId: result.lastInsertRowid,
      displayOrder,
    }
  } catch (error: unknown) {
    // Handle duplicate pin attempt
    if (error instanceof Error && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw createError({ statusCode: 409, message: 'Item is already pinned' })
    }
    throw error
  }
})
