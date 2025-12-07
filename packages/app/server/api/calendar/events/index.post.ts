import { getDb } from '../../../utils/db'

interface EventInput {
  campaignId: number
  title: string
  description?: string
  eventType: string
  year?: number
  month: number
  day: number
  isRecurring?: boolean
  entityId?: number // Legacy single entity
  entityIds?: number[] // New: multiple entities
  color?: string
}

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody<EventInput>(event)

  if (!body.campaignId || !body.title || !body.month || !body.day) {
    throw createError({
      statusCode: 400,
      message: 'Campaign ID, title, month, and day are required',
    })
  }

  // Insert the event
  const result = db
    .prepare(
      `
    INSERT INTO calendar_events (campaign_id, title, description, event_type, year, month, day, is_recurring, entity_id, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      body.campaignId,
      body.title,
      body.description || null,
      body.eventType || 'custom',
      body.year || null,
      body.month,
      body.day,
      body.isRecurring ? 1 : 0,
      body.entityId || null, // Keep legacy field for backwards compat
      body.color || null,
    )

  const eventId = result.lastInsertRowid as number

  // Insert linked entities (new multi-entity system)
  if (body.entityIds && body.entityIds.length > 0) {
    const insertEntity = db.prepare(`
      INSERT INTO calendar_event_entities (event_id, entity_id, entity_type)
      SELECT ?, e.id, et.name
      FROM entities e
      JOIN entity_types et ON et.id = e.type_id
      WHERE e.id = ? AND e.deleted_at IS NULL
    `)

    for (const entityId of body.entityIds) {
      insertEntity.run(eventId, entityId)
    }
  } else if (body.entityId) {
    // If only legacy entityId provided, also add to junction table
    db.prepare(
      `
      INSERT INTO calendar_event_entities (event_id, entity_id, entity_type)
      SELECT ?, e.id, et.name
      FROM entities e
      JOIN entity_types et ON et.id = e.type_id
      WHERE e.id = ? AND e.deleted_at IS NULL
    `,
    ).run(eventId, body.entityId)
  }

  return {
    success: true,
    id: eventId,
  }
})
