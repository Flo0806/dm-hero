import { getDb } from '~~/server/utils/db'

// Get statistics about calendar data for deletion warning
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

  // Count events
  const eventsCount =
    (
      db.prepare('SELECT COUNT(*) as count FROM calendar_events WHERE campaign_id = ?').get(campaignId) as {
        count: number
      }
    )?.count || 0

  // Count weather entries
  const weatherCount =
    (
      db.prepare('SELECT COUNT(*) as count FROM calendar_weather WHERE campaign_id = ?').get(campaignId) as {
        count: number
      }
    )?.count || 0

  // Count sessions with in-game dates
  const sessionsWithDatesCount =
    (
      db
        .prepare(
          `SELECT COUNT(*) as count FROM sessions
           WHERE campaign_id = ?
           AND (in_game_year_start IS NOT NULL OR in_game_day_start IS NOT NULL)`,
        )
        .get(campaignId) as { count: number }
    )?.count || 0

  // Count seasons
  const seasonsCount =
    (
      db.prepare('SELECT COUNT(*) as count FROM calendar_seasons WHERE campaign_id = ?').get(campaignId) as {
        count: number
      }
    )?.count || 0

  // Count moons
  const moonsCount =
    (
      db.prepare('SELECT COUNT(*) as count FROM calendar_moons WHERE campaign_id = ?').get(campaignId) as {
        count: number
      }
    )?.count || 0

  return {
    events: eventsCount,
    weather: weatherCount,
    sessionsWithDates: sessionsWithDatesCount,
    seasons: seasonsCount,
    moons: moonsCount,
    hasData: eventsCount > 0 || weatherCount > 0 || sessionsWithDatesCount > 0,
  }
})
