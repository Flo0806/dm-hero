import { getDb } from '../../../utils/db'

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
  entity_name?: string
  entity_type?: string
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

  return events
})
