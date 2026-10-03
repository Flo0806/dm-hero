// A player joins with game code + PIN and gets a session cookie
export default defineEventHandler(async (event) => {
  rateLimit(event, 'join', 10, 60 * 1000)
  const body = await readBody<{ code?: string, pin?: string }>(event)
  const code = String(body?.code ?? '').trim().toUpperCase()
  const pin = String(body?.pin ?? '').trim()
  if (!code || !/^\d{6}$/.test(pin)) throw createError({ statusCode: 400, message: 'Code and 6-digit PIN required' })

  const db = useRelayDb()
  const game = db.prepare('SELECT id FROM games WHERE code = ?').get(code) as { id: string } | undefined
  const player = game
    ? db.prepare('SELECT id, name FROM players WHERE game_id = ? AND pin_hash = ?').get(game.id, pinHash(game.id, pin)) as { id: string, name: string } | undefined
    : undefined
  // Same answer for wrong code and wrong PIN - no hint which one was wrong
  if (!game || !player) throw createError({ statusCode: 401, message: 'Code or PIN is wrong' })

  const token = randomToken()
  db.prepare('INSERT INTO player_sessions (token_hash, game_id, player_id, created_at) VALUES (?, ?, ?, ?)')
    .run(sha256(token), game.id, player.id, Date.now())
  setCookie(event, PLAYER_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: !import.meta.dev,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return { gameId: game.id, playerId: player.id, name: player.name }
})
