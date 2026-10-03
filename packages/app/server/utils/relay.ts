import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'

// Talks to the player relay (packages/staging) - always server to server,
// so the DM token never reaches a browser.

export interface RelayAuth {
  relay_game_id: string
  relay_dm_token: string
}

export function relayUrl() {
  return `${useRuntimeConfig().public.stagingUrl}/api/v1`
}

/** Plain PINs never leave this machine - the relay only gets this hash */
export function relayPinHash(relayGameId: string, pin: string) {
  return createHash('sha256').update(`${relayGameId}:${pin}`).digest('hex')
}

/** Registers the game; the relay gets the DM's PUBLIC keys to hand to joining players */
export async function createRelayGame(dmPublicKeys: { signing: string, exchange: string }) {
  try {
    return await $fetch<{ gameId: string, code: string, dmToken: string }>(`${relayUrl()}/games`, {
      method: 'POST',
      body: { dmPublicKeys },
    })
  }
  catch {
    throw createError({ statusCode: 502, message: 'Player server not reachable' })
  }
}

export async function deleteRelayGame(auth: RelayAuth) {
  await $fetch(`${relayUrl()}/games/${auth.relay_game_id}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${auth.relay_dm_token}` },
  })
}

export function getRelayAuth(db: Database.Database, tableId: number): RelayAuth | null {
  const row = db.prepare('SELECT relay_game_id, relay_dm_token FROM game_tables WHERE id = ?').get(tableId) as Partial<RelayAuth> | undefined
  return row?.relay_game_id && row.relay_dm_token ? row as RelayAuth : null
}

/** Sends the full player list (with PIN hashes). Failures are logged, not fatal - the page shows the relay status. */
export async function syncRelayPlayers(db: Database.Database, tableId: number) {
  const auth = getRelayAuth(db, tableId)
  if (!auth) return
  const players = (db.prepare('SELECT id, name, pin FROM game_table_players WHERE game_table_id = ?').all(tableId) as Array<{ id: number, name: string, pin: string }>)
    .map(p => ({ id: String(p.id), name: p.name, pinHash: relayPinHash(auth.relay_game_id, p.pin) }))
  try {
    await $fetch(`${relayUrl()}/games/${auth.relay_game_id}/players`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${auth.relay_dm_token}` },
      body: { players },
    })
  }
  catch (error) {
    console.error('[Relay] Player sync failed:', error)
  }
}

/**
 * Ends a game for good: relay first (players get "game ended" and are kicked),
 * then locally. A relay that is down must not block this - the game then stays on
 * the relay until it's cleaned up there (cleanup of abandoned games is still open).
 */
export async function endGameTable(db: Database.Database, tableId: number) {
  const auth = getRelayAuth(db, tableId)
  if (auth) await deleteRelayGame(auth).catch(error => console.error('[Relay] Delete failed:', error))
  return db.prepare('DELETE FROM game_tables WHERE id = ?').run(tableId).changes > 0
}

/** Shares are sent as sealed envelopes - the relay stores what it can't read */
export async function putRelayShare(auth: RelayAuth, shareKey: string, envelope: unknown) {
  await $fetch(`${relayUrl()}/games/${auth.relay_game_id}/shares/${shareKey}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${auth.relay_dm_token}` },
    body: envelope as Record<string, unknown>,
  })
}

export async function deleteRelayShare(auth: RelayAuth, shareKey: string) {
  await $fetch(`${relayUrl()}/games/${auth.relay_game_id}/shares/${shareKey}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${auth.relay_dm_token}` },
  })
}

/** Encrypted file bytes for the relay's file storage */
export async function putRelayFile(auth: RelayAuth, fileId: string, ciphertext: Uint8Array) {
  try {
    await $fetch(`${relayUrl()}/games/${auth.relay_game_id}/files/${fileId}`, {
      method: 'PUT',
      headers: { 'authorization': `Bearer ${auth.relay_dm_token}`, 'content-type': 'application/octet-stream' },
      body: ciphertext,
    })
  }
  catch (error) {
    const status = (error as { statusCode?: number }).statusCode
    if (status === 413) throw createError({ statusCode: 413, message: 'Storage limit of this game reached' })
    throw error
  }
}

export async function deleteRelayFile(auth: RelayAuth, fileId: string) {
  await $fetch(`${relayUrl()}/games/${auth.relay_game_id}/files/${fileId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${auth.relay_dm_token}` },
  })
}
