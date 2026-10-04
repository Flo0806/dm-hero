// Derived from Nitro's own h3 functions - always the h3 version that actually runs
type H3Event = Parameters<typeof getHeader>[0]

export const PLAYER_COOKIE = 'dmh_player'

/** DM Hero authenticates with the game's DM token (server to server) */
export function requireDm(event: H3Event, gameId: string) {
  const game = findGame(gameId)
  if (!game) throw createError({ statusCode: 404, message: 'Game not found' })
  const token = getHeader(event, 'authorization')?.replace(/^Bearer /, '') ?? ''
  if (!sameHash(sha256(token), game.dm_token_hash)) throw createError({ statusCode: 403, message: 'Not the DM of this game' })
  touchGame(game.id)
  return game
}

export interface PlayerSession {
  player_id: string
  name: string
  /** Device's exchange public key (sent on join) */
  public_key: string | null
  /** Game key wrapped by DM Hero for this device (JSON envelope) */
  wrapped_key: string | null
}

/** Players authenticate with the session cookie they got when joining */
export function requirePlayer(event: H3Event, gameId: string) {
  const token = getCookie(event, PLAYER_COOKIE)
  const tokenHash = token ? sha256(token) : ''
  const session = token
    ? useRelayDb().prepare(`
        SELECT s.player_id, s.public_key, s.wrapped_key, p.name FROM player_sessions s
        JOIN players p ON p.game_id = s.game_id AND p.id = s.player_id
        WHERE s.token_hash = ? AND s.game_id = ?
      `).get(tokenHash, gameId) as PlayerSession | undefined
    : undefined
  if (!session) throw createError({ statusCode: 401, message: 'Not joined to this game' })
  // Used -> stays valid another full period (cookie + session slide together)
  if (touchSession(tokenHash)) setPlayerCookie(event, token!)
  return session
}

/** The player's login cookie - lives as long as an unused session does */
export function setPlayerCookie(event: H3Event, token: string) {
  setCookie(event, PLAYER_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: !import.meta.dev,
    path: '/',
    maxAge: 60 * 60 * 24 * Number(useRuntimeConfig().sessionTtlDays),
  })
}
