import { derivePairKey, importExchangePublicKey, loadGameKeys, wrapGameKey, type StoredGameKeys } from '@dm-hero/seal'
import { getDb } from './db'
import { getRelayAuth, relayUrl } from './relay'

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
    { v: 1, gameId: table.relay_game_id, from: 'dm', to: String(playerId), epoch: 1, seq: Date.now() },
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
