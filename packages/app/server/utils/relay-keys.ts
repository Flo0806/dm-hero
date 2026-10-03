import { derivePairKey, importExchangePublicKey, loadGameKeys, rotateGameKey, wrapGameKey, type StoredGameKeys } from '@dm-hero/seal'
import { getDb } from './db'
import { getRelayAuth, relayUrl } from './relay'
import { syncTableMap } from './share/map'
import { syncTableShares, withTableLock } from './share/sync'

// Game key delivery per player device. New devices need the DM's approval first -
// only then the relay can't sneak in a device of its own.

export function isKnownPlayer(tableId: number, playerId: number) {
  return !!getDb().prepare('SELECT 1 FROM game_table_players WHERE id = ? AND game_table_id = ?').get(playerId, tableId)
}

export function isApprovedDevice(tableId: number, playerId: number, publicKey: string) {
  return !!getDb().prepare('SELECT 1 FROM game_table_devices WHERE game_table_id = ? AND player_id = ? AND public_key = ?')
    .get(tableId, playerId, publicKey)
}

/** Wrap the game key for exactly this device (DM <-> device pair key), signed by the DM */
export async function deliverGameKey(tableId: number, playerId: number, publicKey: string) {
  const db = getDb()
  const table = db.prepare('SELECT relay_game_id, relay_dm_token, e2e_keys FROM game_tables WHERE id = ?')
    .get(tableId) as { relay_game_id: string, relay_dm_token: string, e2e_keys: string | null } | undefined
  if (!table?.e2e_keys) return

  const keys = await loadGameKeys(JSON.parse(table.e2e_keys) as StoredGameKeys)
  const pairKey = await derivePairKey(keys.exchangeKey, await importExchangePublicKey(publicKey), table.relay_game_id)
  const envelope = await wrapGameKey(
    keys.gameKey,
    pairKey,
    { v: 1, gameId: table.relay_game_id, from: 'dm', to: String(playerId), epoch: keys.epoch, seq: Date.now() },
    keys.signingKey,
  )

  await $fetch(`${relayUrl()}/games/${table.relay_game_id}/keys`, {
    method: 'POST',
    headers: { authorization: `Bearer ${table.relay_dm_token}` },
    body: { playerId: String(playerId), publicKey, envelope },
  })
}

/** DM approved: remember the device and hand it the game key */
export async function approveDevice(tableId: number, playerId: number, publicKey: string) {
  getDb().prepare('INSERT OR IGNORE INTO game_table_devices (game_table_id, player_id, public_key) VALUES (?, ?, ?)')
    .run(tableId, playerId, publicKey)
  await deliverGameKey(tableId, playerId, publicKey)
}

/** DM rejected: the relay ends that device's session */
export async function rejectDevice(tableId: number, playerId: number, publicKey: string) {
  const auth = getRelayAuth(getDb(), tableId)
  if (!auth) return
  await $fetch(`${relayUrl()}/games/${auth.relay_game_id}/devices`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${auth.relay_dm_token}` },
    body: { playerId: String(playerId), publicKey },
  })
}

/**
 * Key rotation after a player was removed or got a new PIN: a new game key
 * goes to every remaining approved device, then all shares are re-encrypted
 * with it. The removed device keeps only the old key - nothing new to read.
 */
export async function rotateTableKey(tableId: number) {
  const db = getDb()
  await withTableLock(tableId, async () => {
    const row = db.prepare('SELECT e2e_keys FROM game_tables WHERE id = ?').get(tableId) as { e2e_keys: string | null } | undefined
    if (!row?.e2e_keys) return
    const rotated = await rotateGameKey(JSON.parse(row.e2e_keys) as StoredGameKeys)
    db.prepare('UPDATE game_tables SET e2e_keys = ? WHERE id = ?').run(JSON.stringify(rotated), tableId)

    const devices = db.prepare('SELECT player_id, public_key FROM game_table_devices WHERE game_table_id = ?')
      .all(tableId) as Array<{ player_id: number, public_key: string }>
    for (const device of devices) {
      // A device without a live session gets the new key when it asks again
      await deliverGameKey(tableId, device.player_id, device.public_key)
        .catch(error => console.error('[Relay] Key rotation delivery failed:', error))
    }
    // Everything players have was sealed with the old key -> re-send all
    db.prepare('UPDATE game_table_shares SET content_hash = NULL WHERE game_table_id = ?').run(tableId)
    db.prepare('UPDATE game_tables SET map_hash = NULL, fog_hash = NULL WHERE id = ?').run(tableId)
  })
  await syncTableShares(db, tableId)
  await syncTableMap(db, tableId)
}
