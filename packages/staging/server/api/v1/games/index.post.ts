// DM Hero registers a game with the DM's PUBLIC keys. Returns id, a globally unique code and the secret DM token.
export default defineEventHandler(async (event) => {
  rateLimit(event, 'create-game', 20, 60 * 60 * 1000)
  const body = await readBody<{ dmPublicKeys?: { signing?: string, exchange?: string } }>(event)
  const keys = body?.dmPublicKeys
  if (!isPublicKey(keys?.signing) || !isPublicKey(keys?.exchange)) {
    throw createError({ statusCode: 400, message: 'DM public keys required' })
  }
  const db = useRelayDb()

  const id = randomToken(16)
  const dmToken = randomToken()
  let code = randomGameCode()
  while (db.prepare('SELECT 1 FROM games WHERE code = ?').get(code)) code = randomGameCode()

  db.prepare('INSERT INTO games (id, code, dm_token_hash, created_at, dm_signing_public, dm_exchange_public) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, code, sha256(dmToken), Date.now(), keys!.signing!, keys!.exchange!)
  return { gameId: id, code, dmToken }
})
