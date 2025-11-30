import { getDb } from '../../../utils/db'

interface EventInput {
  title?: string
  description?: string
  eventType?: string
  year?: number | null
  month?: number
  day?: number
  isRecurring?: boolean
  entityId?: number | null
  color?: string | null
}

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')
  const body = await readBody<EventInput>(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Event ID is required',
    })
  }

  // Build dynamic update query
  const updates: string[] = []
  const values: (string | number | null)[] = []

  if (body.title !== undefined) {
    updates.push('title = ?')
    values.push(body.title)
  }
  if (body.description !== undefined) {
    updates.push('description = ?')
    values.push(body.description)
  }
  if (body.eventType !== undefined) {
    updates.push('event_type = ?')
    values.push(body.eventType)
  }
  if (body.year !== undefined) {
    updates.push('year = ?')
    values.push(body.year)
  }
  if (body.month !== undefined) {
    updates.push('month = ?')
    values.push(body.month)
  }
  if (body.day !== undefined) {
    updates.push('day = ?')
    values.push(body.day)
  }
  if (body.isRecurring !== undefined) {
    updates.push('is_recurring = ?')
    values.push(body.isRecurring ? 1 : 0)
  }
  if (body.entityId !== undefined) {
    updates.push('entity_id = ?')
    values.push(body.entityId)
  }
  if (body.color !== undefined) {
    updates.push('color = ?')
    values.push(body.color)
  }

  if (updates.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No fields to update',
    })
  }

  updates.push('updated_at = CURRENT_TIMESTAMP')
  values.push(Number(id))

  db.prepare(`
    UPDATE calendar_events
    SET ${updates.join(', ')}
    WHERE id = ?
  `).run(...values)

  return { success: true }
})
