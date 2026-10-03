import { derivePairKey, importExchangePublicKey, loadGameKeys, wrapGameKey, type StoredGameKeys } from '@dm-hero/seal'
import { getDb } from './db'
import { relayUrl } from './relay'

// A player's device asked for the game key: wrap it for exactly that device
// (DM <-> device pair key) and sign it as the DM. The relay can't open it.
export async function answerKeyRequest(tableId: number, playerId: string, publicKey: string) {
  const db = getDb()
  const table = db.prepare('SELECT relay_game_id, relay_dm_token, e2e_keys FROM game_tables WHERE id = ?')
    .get(tableId) as { relay_game_id: string, relay_dm_token: string, e2e_keys: string | null } | undefined
  if (!table?.e2e_keys) return

  // Only players the DM actually added to this table
  const known = db.prepare('SELECT 1 FROM game_table_players WHERE id = ? AND game_table_id = ?').get(Number(playerId), tableId)
  if (!known) return

  const keys = await loadGameKeys(JSON.parse(table.e2e_keys) as StoredGameKeys)
  const pairKey = await derivePairKey(keys.exchangeKey, await importExchangePublicKey(publicKey), table.relay_game_id)
  const envelope = await wrapGameKey(
    keys.gameKey,
    pairKey,
    { v: 1, gameId: table.relay_game_id, from: 'dm', to: playerId, epoch: 1, seq: Date.now() },
    keys.signingKey,
  )

  await $fetch(`${relayUrl()}/games/${table.relay_game_id}/keys`, {
    method: 'POST',
    headers: { authorization: `Bearer ${table.relay_dm_token}` },
    body: { playerId, publicKey, envelope },
  })
}
