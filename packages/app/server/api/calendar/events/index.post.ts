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
  entityId?: number
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

  const result = db.prepare(`
    INSERT INTO calendar_events (campaign_id, title, description, event_type, year, month, day, is_recurring, entity_id, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    body.campaignId,
    body.title,
    body.description || null,
    body.eventType || 'custom',
    body.year || null,
    body.month,
    body.day,
    body.isRecurring ? 1 : 0,
    body.entityId || null,
    body.color || null,
  )

  return {
    success: true,
    id: result.lastInsertRowid,
  }
})
