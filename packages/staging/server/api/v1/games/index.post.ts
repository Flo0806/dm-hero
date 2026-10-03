// DM Hero registers a game. Returns id, a globally unique code and the secret DM token.
export default defineEventHandler((event) => {
  rateLimit(event, 'create-game', 20, 60 * 60 * 1000)
  const db = useRelayDb()

  const id = randomToken(16)
  const dmToken = randomToken()
  let code = randomGameCode()
  while (db.prepare('SELECT 1 FROM games WHERE code = ?').get(code)) code = randomGameCode()

  db.prepare('INSERT INTO games (id, code, dm_token_hash, created_at) VALUES (?, ?, ?, ?)')
    .run(id, code, sha256(dmToken), Date.now())
  return { gameId: id, code, dmToken }
})
