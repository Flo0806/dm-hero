import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'

// Talks to the player relay (packages/staging) - always server to server,
// so the DM token never reaches a browser.

interface RelayAuth {
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

export async function createRelayGame() {
  try {
    return await $fetch<{ gameId: string, code: string, dmToken: string }>(`${relayUrl()}/games`, { method: 'POST' })
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
