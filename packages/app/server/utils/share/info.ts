import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'
import { CAMPAIGN_NAME_MAX, loadGameKeys, seal, type StoredGameKeys, type TableInfoContent } from '@dm-hero/seal'
import { getRelayAuth, putRelayState } from '../relay'
import { withTableLock } from './sync'

// Game info for joined players (campaign name) - sent when it changes.
// What was sent last is kept in memory: after a restart it's simply sent once more.
const sent = new Map<number, string>()

/** Send again on the next sync (new keys, game registered anew) */
export const forgetTableInfo = (tableId: number) => sent.delete(tableId)

async function runInfoSync(db: Database.Database, tableId: number) {
  const auth = getRelayAuth(db, tableId)
  const row = db.prepare(`
    SELECT g.relay_game_id, g.e2e_keys, c.name AS campaign_name
    FROM game_tables g JOIN campaigns c ON c.id = g.campaign_id
    WHERE g.id = ?
  `).get(tableId) as { relay_game_id: string, e2e_keys: string | null, campaign_name: string } | undefined
  if (!auth || !row?.e2e_keys) return

  const content: TableInfoContent = { kind: 'info', campaignName: row.campaign_name.slice(0, CAMPAIGN_NAME_MAX) }
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
