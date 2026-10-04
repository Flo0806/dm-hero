import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'
import { CAMPAIGN_NAME_MAX, loadGameKeys, seal, type StoredGameKeys, type TableInfoContent, type TableWeather } from '@dm-hero/seal'
import { getRelayAuth, putRelayState } from '../relay'
import { withTableLock } from './sync'

// Game info for joined players (campaign name, today's weather) - sent when it changes.
// What was sent last is kept in memory: after a restart it's simply sent once more.
const sent = new Map<number, string>()

/** Send again on the next sync (new keys, game registered anew) */
export const forgetTableInfo = (tableId: number) => sent.delete(tableId)

/**
 * Today's weather as the players feel it: the active climate zone's, else the
 * general one of the day. No calendar or nothing rolled for today -> none.
 */
export function currentWeather(db: Database.Database, campaignId: number): TableWeather | undefined {
  const today = db.prepare('SELECT current_year, current_month, current_day FROM calendar_config WHERE campaign_id = ?')
    .get(campaignId) as { current_year: number, current_month: number, current_day: number } | undefined
  if (!today) return undefined
  const zone = (db.prepare('SELECT active_climate_zone_id FROM campaigns WHERE id = ?').get(campaignId) as { active_climate_zone_id: number | null } | undefined)
    ?.active_climate_zone_id ?? null
  type Row = { weather_type: string, temperature: number | null }
  const day = 'campaign_id = ? AND year = ? AND month = ? AND day = ?'
  const args = [campaignId, today.current_year, today.current_month, today.current_day]
  const inZone = zone !== null
    ? db.prepare(`SELECT weather_type, temperature FROM calendar_weather WHERE ${day} AND zone_id = ?`).get(...args, zone) as Row | undefined
    : undefined
  const weather = inZone ?? db.prepare(`SELECT weather_type, temperature FROM calendar_weather WHERE ${day} AND zone_id IS NULL`).get(...args) as Row | undefined
  return weather ? { type: weather.weather_type, temperature: weather.temperature } : undefined
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
