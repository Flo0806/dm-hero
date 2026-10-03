import type { H3Event } from 'h3'

export const PLAYER_COOKIE = 'dmh_player'

/** DM Hero authenticates with the game's DM token (server to server) */
export function requireDm(event: H3Event, gameId: string) {
  const game = findGame(gameId)
  if (!game) throw createError({ statusCode: 404, message: 'Game not found' })
  const token = getHeader(event, 'authorization')?.replace(/^Bearer /, '') ?? ''
  if (!sameHash(sha256(token), game.dm_token_hash)) throw createError({ statusCode: 403, message: 'Not the DM of this game' })
  return game
}

/** Players authenticate with the session cookie they got when joining */
export function requirePlayer(event: H3Event, gameId: string) {
  const token = getCookie(event, PLAYER_COOKIE)
  const session = token
    ? useRelayDb().prepare(`
        SELECT s.player_id, p.name FROM player_sessions s
        JOIN players p ON p.game_id = s.game_id AND p.id = s.player_id
        WHERE s.token_hash = ? AND s.game_id = ?
      `).get(sha256(token), gameId) as { player_id: string, name: string } | undefined
    : undefined
  if (!session) throw createError({ statusCode: 401, message: 'Not joined to this game' })
  return session
}
