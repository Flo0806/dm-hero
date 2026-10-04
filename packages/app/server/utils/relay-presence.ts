import { derivePairKey, fingerprint, importExchangePublicKey, isChatPostContent, loadGameKeys, open, type Envelope, type LoadedGameKeys, type StoredGameKeys } from '@dm-hero/seal'
import { isPingContent, type TablePing } from '~~/types/fog'
import type { GameTablePresence } from '~~/types/game-table'
import { getDb } from './db'
import { ackRelayMessage, getRelayAuth, relayUrl } from './relay'
import { deliverGameKey, isApprovedDevice, isKnownPlayer } from './relay-keys'
import { syncTableHandouts } from './share/handouts'
import { syncTableInfo } from './share/info'
import { markThreadDirty, pruneConversation, syncTableThreads } from './share/messages'
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
  // Handouts (document changed, newly approved device ...)
  syncTableHandouts(getDb(), tableId).catch(error => console.error('[Relay] Handout sync failed:', error))
  // Conversations (a newly approved device gets them too)
  syncTableThreads(getDb(), tableId).catch(error => console.error('[Relay] Message sync failed:', error))
  // Campaign name (renamed meanwhile)
  syncTableInfo(getDb(), tableId).catch(error => console.error('[Relay] Info sync failed:', error))
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
      else if (event === 'message') {
        queueMessage(tableId, JSON.parse(data) as RelayMessage)
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

// ---------------------------------------------------------------------------
// Private messages from players -> stored, then open pages are told (exported for tests)
// ---------------------------------------------------------------------------

const messageListeners = new Map<number, Set<(playerId: number) => void>>()

interface RelayMessage {
  id: string
  playerId: string
  publicKey: string
  envelope: Envelope
  /** When the player sent it (ms) - kept as its time, not when DM Hero picked it up */
  sentAt?: number
}

// One after another per game: a batch after a pause is stored in the order it was sent
const messageQueues = new Map<number, Promise<void>>()
function queueMessage(tableId: number, message: RelayMessage) {
  const next = (messageQueues.get(tableId) ?? Promise.resolve())
    .then(() => handleMessage(tableId, message))
    .catch(error => console.error('[Relay] Message rejected:', error))
  messageQueues.set(tableId, next)
}

// Keys of a game, loaded once (not per message) - replaced when the stored keys change
const keyCache = new Map<number, { stored: string, keys: Promise<LoadedGameKeys>, pairs: Map<string, Promise<CryptoKey>> }>()
function pairKeyFor(tableId: number, stored: string, gameId: string, publicKey: string) {
  let entry = keyCache.get(tableId)
  if (!entry || entry.stored !== stored) {
    entry = { stored, keys: loadGameKeys(JSON.parse(stored) as StoredGameKeys), pairs: new Map() }
    keyCache.set(tableId, entry)
  }
  let pair = entry.pairs.get(publicKey)
  if (!pair) {
    const keys = entry.keys
    pair = (async () => derivePairKey((await keys).exchangeKey, await importExchangePublicKey(publicKey), gameId))()
    entry.pairs.set(publicKey, pair)
  }
  return pair
}

const toSqliteTime = (ms: number) => new Date(ms).toISOString().replace('T', ' ').slice(0, 19)

/** Live "a player wrote" for open pages (the relay connection is kept by watchPresence) */
export function watchMessages(tableId: number, listener: (playerId: number) => void) {
  if (!messageListeners.has(tableId)) messageListeners.set(tableId, new Set())
  messageListeners.get(tableId)!.add(listener)
  return () => messageListeners.get(tableId)?.delete(listener)
}

export async function handleMessage(tableId: number, message: RelayMessage) {
  const db = getDb()
  const auth = getRelayAuth(db, tableId)
  const playerId = Number(message.playerId)
  const table = db.prepare('SELECT relay_game_id, e2e_keys FROM game_tables WHERE id = ?').get(tableId) as { relay_game_id: string, e2e_keys: string | null } | undefined
  if (!auth || !table?.e2e_keys) return
  // Only approved devices of known players - anything else is dropped from the relay
  if (isKnownPlayer(tableId, playerId) && isApprovedDevice(tableId, playerId, message.publicKey)) {
    const pairKey = await pairKeyFor(tableId, table.e2e_keys, table.relay_game_id, message.publicKey)
    const { header } = message.envelope
    const content = header.gameId === table.relay_game_id && header.to === 'dm'
      ? await open<unknown>(pairKey, message.envelope).catch(() => null)
      : null
    if (isChatPostContent(content)) {
      // message_key from the player's own id: delivered twice -> stored once, and the
      // player recognises it in the conversation ("delivered")
      const sentAt = Number.isFinite(message.sentAt) && message.sentAt! <= Date.now() ? message.sentAt! : Date.now()
      const inserted = db.prepare('INSERT OR IGNORE INTO game_table_messages (game_table_id, player_id, message_key, sender, text, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(tableId, playerId, `p-${playerId}-${content.id}`, 'player', content.text.trim(), toSqliteTime(sentAt)).changes > 0
      if (inserted) {
        pruneConversation(db, tableId, playerId)
        markThreadDirty(db, playerId)
        for (const listener of messageListeners.get(tableId) ?? []) listener(playerId)
        // The player's other devices (and this one) see it in the conversation
        syncTableThreads(db, tableId, playerId).catch(error => console.error('[Relay] Message sync failed:', error))
      }
    }
  }
  await ackRelayMessage(auth, message.id)
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

/** Game registered anew on the relay: reconnect, open pages stay subscribed */
export function restartPresence(tableId: number) {
  const conn = connections.get(tableId)
  if (!conn) return
  conn.abort.abort()
  if (conn.retry) clearTimeout(conn.retry)
  if (conn.sync) clearInterval(conn.sync)
  conn.retry = null
  conn.sync = null
  conn.abort = new AbortController()
  conn.state = { connected: false, online: [], pending: [] }
  emit(tableId)
  void run(tableId)
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
