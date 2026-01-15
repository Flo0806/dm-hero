import { getDb } from '~~/server/utils/db'

// Reset/delete all calendar data for a campaign
export default defineEventHandler((event) => {
  const db = getDb()
  const query = getQuery(event)
  const campaignId = query.campaignId as string

  if (!campaignId) {
    throw createError({
      statusCode: 400,
      message: 'Campaign ID is required',
    })
  }

  // Delete in correct order to respect foreign keys
  // 1. Delete weather data
  db.prepare('DELETE FROM calendar_weather WHERE campaign_id = ?').run(campaignId)

  // 2. Delete event entities (junction table)
  db.prepare(
    `DELETE FROM calendar_event_entities
     WHERE event_id IN (SELECT id FROM calendar_events WHERE campaign_id = ?)`,
  ).run(campaignId)

  // 3. Delete events
  db.prepare('DELETE FROM calendar_events WHERE campaign_id = ?').run(campaignId)

  // 4. Delete seasons
  db.prepare('DELETE FROM calendar_seasons WHERE campaign_id = ?').run(campaignId)

  // 5. Delete moons
  db.prepare('DELETE FROM calendar_moons WHERE campaign_id = ?').run(campaignId)

  // 6. Delete weekdays
  db.prepare('DELETE FROM calendar_weekdays WHERE campaign_id = ?').run(campaignId)

  // 7. Delete months
  db.prepare('DELETE FROM calendar_months WHERE campaign_id = ?').run(campaignId)

  // 8. Delete config
  db.prepare('DELETE FROM calendar_config WHERE campaign_id = ?').run(campaignId)

  // 9. Clear session in-game dates (but keep sessions)
  db.prepare(
    `UPDATE sessions SET
       in_game_year_start = NULL,
       in_game_month_start = NULL,
       in_game_day_start = NULL,
       in_game_year_end = NULL,
       in_game_month_end = NULL,
       in_game_day_end = NULL,
       in_game_date_start = NULL,
       in_game_date_end = NULL,
       calendar_event_id = NULL
     WHERE campaign_id = ?`,
  ).run(campaignId)

  return { success: true }
})
