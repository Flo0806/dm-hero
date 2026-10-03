import { getDb } from './db'
import { getRelayAuth, relayUrl } from './relay'
import { answerKeyRequest } from './relay-keys'

// Keeps one outgoing SSE connection per game to the relay (works behind any router)
// and fans the "who is online" state out to open game table pages.

export interface PresenceState {
  /** Relay reachable and stream open */
  connected: boolean
  /** Local game_table_players ids that are online */
  online: number[]
}

type Listener = (state: PresenceState) => void

interface Connection {
  state: PresenceState
  listeners: Set<Listener>
  abort: AbortController
  retry: ReturnType<typeof setTimeout> | null
}

const RETRY_MS = 3000
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
    if (!res.ok || !res.body) throw new Error(`Relay answered ${res.status}`)
    conn.state = { ...conn.state, connected: true }
    emit(tableId)

    await readEvents(res.body, (event, data) => {
      if (event === 'presence') {
        const { online } = JSON.parse(data) as { online: string[] }
        conn.state = { connected: true, online: online.map(Number) }
        emit(tableId)
      }
      else if (event === 'key-request') {
        const { playerId, publicKey } = JSON.parse(data) as { playerId: string, publicKey: string }
        answerKeyRequest(tableId, playerId, publicKey).catch(error => console.error('[Relay] Key request failed:', error))
      }
    })
  }
  catch {
    // Network error or relay down - handled below
  }

  if (conn.abort.signal.aborted) return
  conn.state = { connected: false, online: [] }
  emit(tableId)
  conn.retry = setTimeout(() => run(tableId), RETRY_MS)
}

/** Subscribe to presence of a game; starts the relay connection on first use */
export function watchPresence(tableId: number, listener: Listener) {
  let conn = connections.get(tableId)
  if (!conn) {
    conn = { state: { connected: false, online: [] }, listeners: new Set(), abort: new AbortController(), retry: null }
    connections.set(tableId, conn)
    void run(tableId)
  }
  conn.listeners.add(listener)
  listener(conn.state)
  return () => conn!.listeners.delete(listener)
}

/** Game ended: drop the relay connection */
export function stopPresence(tableId: number) {
  const conn = connections.get(tableId)
  if (!conn) return
  conn.abort.abort()
  if (conn.retry) clearTimeout(conn.retry)
  connections.delete(tableId)
}
