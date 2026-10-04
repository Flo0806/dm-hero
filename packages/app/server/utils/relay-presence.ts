import { fingerprint, loadGameKeys, open, type Envelope, type StoredGameKeys } from '@dm-hero/seal'
import { isPingContent, type TablePing } from '~~/types/fog'
import type { GameTablePresence } from '~~/types/game-table'
import { getDb } from './db'
import { getRelayAuth, relayUrl } from './relay'
import { deliverGameKey, isApprovedDevice, isKnownPlayer } from './relay-keys'
import { syncTableMap } from './share/map'
import { isTableBusy, syncTableShares } from './share/sync'

// Keeps one outgoing SSE connection per game to the relay (works behind any router)
// and fans the "who is online" state (+ devices waiting for approval) out to open pages.

export type PresenceState = GameTablePresence

type Listener = (state: PresenceState) => void

interface Connection {
  state: PresenceState
  listeners: Set<Listener>
  abort: AbortController
  retry: ReturnType<typeof setTimeout> | null
  idle: ReturnType<typeof setTimeout> | null
  sync: ReturnType<typeof setInterval> | null
}

const RETRY_MS = 3000
// Nobody watching (campaign switched, app closed) -> disconnect. Long enough to survive a page reload.
const IDLE_MS = 30_000
// "Always live": while connected, changed shares are re-sent this often
const SHARE_SYNC_MS = 5000

function runShareSync(tableId: number) {
  // Previous round still running (big images, slow relay) -> skip this tick
  if (isTableBusy(tableId)) return
  syncTableShares(getDb(), tableId).catch(error => console.error('[Relay] Share sync failed:', error))
  // Shown map: new image, renamed, fog not sent yet (relay was down) ...
  syncTableMap(getDb(), tableId).catch(error => console.error('[Relay] Map sync failed:', error))
}
const connections = new Map<number, Connection>()

function emit(tableId: number) {
  const conn = connections.get(tableId)
  if (conn) for (const listener of conn.listeners) listener(conn.state)
}

/** Minimal SSE parser for fetch streams (Node has no EventSource) */
async function readEvents(body: ReadableStream<Uint8Array>, onEvent: (event: string, data: string) => void) {
  const decoder = new TextDecoder()
  let buffer = ''
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true })
    let boundary
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      let event = 'message'
      const data: string[] = []
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data.push(line.slice(5).trim())
      }
      onEvent(event, data.join('\n'))
    }
  }
}

async function run(tableId: number) {
  const conn = connections.get(tableId)
  const auth = getRelayAuth(getDb(), tableId)
  if (!conn || !auth) return stopPresence(tableId)

  try {
    const res = await fetch(`${relayUrl()}/games/${auth.relay_game_id}/dm-events`, {
      headers: { authorization: `Bearer ${auth.relay_dm_token}` },
      signal: conn.abort.signal,
    })
    // Game cleaned up on the relay (long without contact) - retrying won't bring it back
    if (res.status === 404) {
      conn.state = { connected: false, online: [], pending: [], expired: true }
      emit(tableId)
      return
    }
    if (!res.ok || !res.body) throw new Error(`Relay answered ${res.status}`)
    conn.state = { ...conn.state, connected: true }
    emit(tableId)
    runShareSync(tableId)
    conn.sync = setInterval(() => runShareSync(tableId), SHARE_SYNC_MS)

    await readEvents(res.body, (event, data) => {
      if (event === 'presence') {
        const { online } = JSON.parse(data) as { online: string[] }
        conn.state = { ...conn.state, connected: true, online: online.map(Number) }
        emit(tableId)
      }
      else if (event === 'ping') {
        handlePing(tableId, JSON.parse(data) as { from: string, name: string, envelope: Envelope })
          .catch(error => console.error('[Relay] Ping rejected:', error))
      }
      else if (event === 'key-request') {
        const { playerId, publicKey } = JSON.parse(data) as { playerId: string, publicKey: string }
        handleKeyRequest(tableId, Number(playerId), publicKey).catch(error => console.error('[Relay] Key request failed:', error))
      }
    })
  }
  catch {
    // Network error or relay down - handled below
  }

  if (conn.sync) clearInterval(conn.sync)
  conn.sync = null
  if (conn.abort.signal.aborted) return
  // Pending requests are sent again by the relay after reconnecting
  conn.state = { connected: false, online: [], pending: [] }
  emit(tableId)
  conn.retry = setTimeout(() => run(tableId), RETRY_MS)
}

/** Approved device -> game key right away. New device -> wait for the DM. */
async function handleKeyRequest(tableId: number, playerId: number, publicKey: string) {
  if (!isKnownPlayer(tableId, playerId)) return
  if (isApprovedDevice(tableId, playerId, publicKey)) return deliverGameKey(tableId, playerId, publicKey)

  const conn = connections.get(tableId)
  if (!conn || conn.state.pending.some(p => p.publicKey === publicKey)) return
  conn.state = { ...conn.state, pending: [...conn.state.pending, { playerId, publicKey, fingerprint: await fingerprint(publicKey) }] }
  emit(tableId)
}

// ---------------------------------------------------------------------------
// Pings from players -> open map pages
// ---------------------------------------------------------------------------

const pingListeners = new Map<number, Set<(ping: TablePing) => void>>()

/** Live pings of a game (the relay connection itself is kept by watchPresence) */
export function watchPings(tableId: number, listener: (ping: TablePing) => void) {
  if (!pingListeners.has(tableId)) pingListeners.set(tableId, new Set())
  pingListeners.get(tableId)!.add(listener)
  return () => pingListeners.get(tableId)?.delete(listener)
}

async function handlePing(tableId: number, ping: { from: string, name: string, envelope: Envelope }) {
  const listeners = pingListeners.get(tableId)
  if (!listeners?.size || !isKnownPlayer(tableId, Number(ping.from))) return
  const row = getDb().prepare('SELECT e2e_keys FROM game_tables WHERE id = ?').get(tableId) as { e2e_keys: string | null } | undefined
  if (!row?.e2e_keys) return
  // Encrypted with the game key by a player - only the game can read it
  const content = await open<unknown>((await loadGameKeys(JSON.parse(row.e2e_keys) as StoredGameKeys)).gameKey, ping.envelope)
  if (!isPingContent(content)) return
  // Notes are the DM's - a player's ping is just a spot
  const { text: _ignored, ...spot } = content
  for (const listener of listeners) listener({ ...spot, from: Number(ping.from), name: ping.name })
}

/** DM decided on a device - remove it from the waiting list */
export function resolvePending(tableId: number, publicKey: string) {
  const conn = connections.get(tableId)
  if (!conn) return
  conn.state = { ...conn.state, pending: conn.state.pending.filter(p => p.publicKey !== publicKey) }
  emit(tableId)
}

/** Subscribe to presence of a game; starts the relay connection on first use */
export function watchPresence(tableId: number, listener: Listener) {
  let conn = connections.get(tableId)
  if (!conn) {
    conn = { state: { connected: false, online: [], pending: [] }, listeners: new Set(), abort: new AbortController(), retry: null, idle: null, sync: null }
    connections.set(tableId, conn)
    void run(tableId)
  }
  if (conn.idle) clearTimeout(conn.idle)
  conn.idle = null
  conn.listeners.add(listener)
  listener(conn.state)

  return () => {
    conn!.listeners.delete(listener)
    if (conn!.listeners.size === 0) conn!.idle = setTimeout(() => stopPresence(tableId), IDLE_MS)
  }
}

/** Game ended: drop the relay connection */
export function stopPresence(tableId: number) {
  const conn = connections.get(tableId)
  if (!conn) return
  conn.abort.abort()
  if (conn.retry) clearTimeout(conn.retry)
  if (conn.idle) clearTimeout(conn.idle)
  if (conn.sync) clearInterval(conn.sync)
  connections.delete(tableId)
}
