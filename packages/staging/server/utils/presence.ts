import type { EventStream } from 'h3'

// Live connections per game (in memory). Players: who is online. DM: gets presence updates.
interface GameStreams {
  players: Map<string, Set<EventStream>>
  dm: Set<EventStream>
}

const games = new Map<string, GameStreams>()

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

export function addPlayerStream(gameId: string, playerId: string, stream: EventStream) {
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
