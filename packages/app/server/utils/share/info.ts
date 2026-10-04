import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'
import { CAMPAIGN_NAME_MAX, loadGameKeys, parseTableWeather, seal, type StoredGameKeys, type TableInfoContent, type TableWeather } from '@dm-hero/seal'
import { getRelayAuth, putRelayState } from '../relay'
import { withTableLock } from './sync'

// Game info for joined players (campaign name, today's weather) - sent when it changes.
// What was sent last is kept in memory: after a restart it's simply sent once more.
const sent = new Map<number, string>()

/** Send again on the next sync (new keys, game registered anew) */
export const forgetTableInfo = (tableId: number) => sent.delete(tableId)

// One cached statement per database: runs every 5 s per connected game
const weatherQueries = new WeakMap<Database.Database, Database.Statement>()

/**
 * Today's weather - exactly what the DM's dashboard shows: with an active climate
 * zone that zone's weather, without one the general weather. No calendar or
 * nothing set for today -> none. Unknown types (imports, old data) are left out.
 */
export function currentWeather(db: Database.Database, campaignId: number): TableWeather | undefined {
  let query = weatherQueries.get(db)
  if (!query) {
    query = db.prepare(`
      SELECT w.weather_type AS type, w.temperature
      FROM calendar_config c
      JOIN campaigns k ON k.id = c.campaign_id
      JOIN calendar_weather w ON w.campaign_id = c.campaign_id
        AND w.year = c.current_year AND w.month = c.current_month AND w.day = c.current_day
        AND ((k.active_climate_zone_id IS NULL AND w.zone_id IS NULL) OR w.zone_id = k.active_climate_zone_id)
      WHERE c.campaign_id = ?
    `)
    weatherQueries.set(db, query)
  }
  return parseTableWeather(query.get(campaignId))
}

async function runInfoSync(db: Database.Database, tableId: number) {
  const auth = getRelayAuth(db, tableId)
  const row = db.prepare(`
    SELECT g.relay_game_id, g.e2e_keys, g.campaign_id, c.name AS campaign_name
    FROM game_tables g JOIN campaigns c ON c.id = g.campaign_id
    WHERE g.id = ?
  `).get(tableId) as { relay_game_id: string, e2e_keys: string | null, campaign_id: number, campaign_name: string } | undefined
  if (!auth || !row?.e2e_keys) return

  const weather = currentWeather(db, row.campaign_id)
  const content: TableInfoContent = { kind: 'info', campaignName: row.campaign_name.slice(0, CAMPAIGN_NAME_MAX), ...(weather && { weather }) }
  const hash = createHash('sha256').update(`${row.relay_game_id}:${JSON.stringify(content)}`).digest('hex')
  if (sent.get(tableId) === hash) return

  const keys = await loadGameKeys(JSON.parse(row.e2e_keys) as StoredGameKeys)
  const envelope = await seal(
    keys.gameKey,
    { v: 1, gameId: row.relay_game_id, from: 'dm', to: 'all', epoch: keys.epoch, seq: Date.now() },
    content,
    keys.signingKey,
  )
  await putRelayState(auth, 'info', envelope)
  sent.set(tableId, hash)
}

export function syncTableInfo(db: Database.Database, tableId: number) {
  return withTableLock(tableId, () => runInfoSync(db, tableId))
}
