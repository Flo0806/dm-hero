import { getDb } from '../../../utils/db'

interface LinkedEntity {
  id: number
  event_id: number
  entity_id: number
  entity_type: string | null
  entity_name: string
  entity_deleted: boolean
}

interface CalendarEvent {
  id: number
  campaign_id: number
  title: string
  description: string | null
  event_type: string
  year: number | null
  month: number
  day: number
  is_recurring: number
  entity_id: number | null
  color: string | null
  // Legacy single entity (backwards compatibility)
  entity_name?: string
  entity_type?: string
  // New: linked entities array
  linked_entities?: LinkedEntity[]
}

export default defineEventHandler((event) => {
  const db = getDb()
  const query = getQuery(event)
  const campaignId = query.campaignId as string
  const year = query.year as string | undefined
  const month = query.month as string | undefined

  if (!campaignId) {
    throw createError({
      statusCode: 400,
      message: 'Campaign ID is required',
    })
  }

  let sql = `
    SELECT
      ce.*,
      e.name as entity_name,
      et.name as entity_type
    FROM calendar_events ce
    LEFT JOIN entities e ON e.id = ce.entity_id
    LEFT JOIN entity_types et ON et.id = e.type_id
    WHERE ce.campaign_id = ?
  `
  const params: (string | number)[] = [Number(campaignId)]

  // Filter by month (for calendar view)
  if (month) {
    sql += ' AND ce.month = ?'
    params.push(Number(month))
  }

  // Filter by year (for non-recurring events)
  // Also include recurring events regardless of year
  if (year) {
    sql += ' AND (ce.year = ? OR ce.is_recurring = 1)'
    params.push(Number(year))
  }

  sql += ' ORDER BY ce.month, ce.day, ce.title'

  const events = db.prepare(sql).all(...params) as CalendarEvent[]

  // Fetch linked entities for all events
  if (events.length > 0) {
    const eventIds = events.map((e) => e.id)
    const placeholders = eventIds.map(() => '?').join(',')

    const linkedEntities = db
      .prepare(
        `
      SELECT
        cee.id,
        cee.event_id,
        cee.entity_id,
        cee.entity_type,
        COALESCE(e.name, '[' || cee.entity_type || ' gelöscht]') as entity_name,
        CASE WHEN e.id IS NULL OR e.deleted_at IS NOT NULL THEN 1 ELSE 0 END as entity_deleted
      FROM calendar_event_entities cee
      LEFT JOIN entities e ON e.id = cee.entity_id AND e.deleted_at IS NULL
      WHERE cee.event_id IN (${placeholders})
      ORDER BY cee.entity_type, entity_name
    `,
      )
      .all(...eventIds) as LinkedEntity[]

    // Group linked entities by event_id
    const entitiesByEvent = new Map<number, LinkedEntity[]>()
    for (const entity of linkedEntities) {
      if (!entitiesByEvent.has(entity.event_id)) {
        entitiesByEvent.set(entity.event_id, [])
      }
      entitiesByEvent.get(entity.event_id)!.push(entity)
    }

    // Attach to events
    for (const ev of events) {
      ev.linked_entities = entitiesByEvent.get(ev.id) || []
    }
  }

  return events
})
