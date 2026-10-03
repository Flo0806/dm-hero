// Derived from Nitro's own h3 - always the h3 version that actually runs
type EventStream = ReturnType<typeof createEventStream>

// Live connections per game (in memory). Players: who is online. DM: gets presence updates.
interface GameStreams {
  players: Map<string, Set<EventStream>>
  dm: Set<EventStream>
}

const games = new Map<string, GameStreams>()
// Which device (public key) a player stream belongs to - for kicking a single device
const streamDevice = new WeakMap<EventStream, string | null>()

function streamsOf(gameId: string) {
  let entry = games.get(gameId)
  if (!entry) {
    entry = { players: new Map(), dm: new Set() }
    games.set(gameId, entry)
  }
  return entry
}

export function onlinePlayers(gameId: string) {
  return [...(games.get(gameId)?.players.entries() ?? [])].filter(([, s]) => s.size > 0).map(([id]) => id)
}

export function broadcastPresence(gameId: string) {
  const data = JSON.stringify({ online: onlinePlayers(gameId) })
  for (const stream of games.get(gameId)?.dm ?? []) void stream.push({ event: 'presence', data })
}

export function addPlayerStream(gameId: string, playerId: string, stream: EventStream, publicKey: string | null) {
  streamDevice.set(stream, publicKey)
  const players = streamsOf(gameId).players
  if (!players.has(playerId)) players.set(playerId, new Set())
  players.get(playerId)!.add(stream)
  broadcastPresence(gameId)
}

export function removePlayerStream(gameId: string, playerId: string, stream: EventStream) {
  games.get(gameId)?.players.get(playerId)?.delete(stream)
  broadcastPresence(gameId)
}

export function addDmStream(gameId: string, stream: EventStream) {
  streamsOf(gameId).dm.add(stream)
}

export function removeDmStream(gameId: string, stream: EventStream) {
  games.get(gameId)?.dm.delete(stream)
}

/** Send an event to all DM Hero connections of a game */
export function sendToDm(gameId: string, event: string, data: unknown) {
  for (const stream of games.get(gameId)?.dm ?? []) void stream.push({ event, data: JSON.stringify(data) })
}

/** Send an event to every connected player of a game */
export function sendToPlayers(gameId: string, event: string, data: unknown) {
  const payload = JSON.stringify(data)
  for (const streams of games.get(gameId)?.players.values() ?? []) {
    for (const stream of streams) void stream.push({ event, data: payload })
  }
}

/** Send an event to all devices of one player */
export function sendToPlayer(gameId: string, playerId: string, event: string, data: unknown) {
  for (const stream of games.get(gameId)?.players.get(playerId) ?? []) void stream.push({ event, data: JSON.stringify(data) })
}

/** Kick players (removed or PIN changed): close their live connections */
export async function disconnectPlayers(gameId: string, playerIds: string[]) {
  const players = games.get(gameId)?.players
  if (!players) return
  for (const id of playerIds) {
    for (const stream of players.get(id) ?? []) await stream.close()
    players.delete(id)
  }
  broadcastPresence(gameId)
}

/** DM rejected a device: close only that device's connections */
export async function disconnectDevice(gameId: string, playerId: string, publicKey: string) {
  const streams = games.get(gameId)?.players.get(playerId)
  for (const stream of [...(streams ?? [])]) {
    if (streamDevice.get(stream) !== publicKey) continue
    streams!.delete(stream)
    await stream.close()
  }
  broadcastPresence(gameId)
}

/** Game ended: close everything */
export async function closeGame(gameId: string) {
  const entry = games.get(gameId)
  if (!entry) return
  // Tell players first, so their page can leave with a message instead of retrying
  for (const set of entry.players.values()) {
    for (const stream of set) {
      await stream.push({ event: 'closed', data: '' })
      await stream.close()
    }
  }
  for (const stream of entry.dm) await stream.close()
  games.delete(gameId)
}
