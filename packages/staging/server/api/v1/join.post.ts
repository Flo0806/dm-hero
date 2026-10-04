// A player joins with game code + PIN and gets a session cookie
export default defineEventHandler(async (event) => {
  rateLimit(event, 'join', 10, 60 * 1000)
  const body = await readBody<{ code?: string, pin?: string, publicKey?: string }>(event)
  const code = String(body?.code ?? '').trim().toUpperCase()
  const pin = String(body?.pin ?? '').trim()
  if (!code || !/^\d{6}$/.test(pin)) throw createError({ statusCode: 400, message: 'Code and 6-digit PIN required' })
  // The device's public key - DM Hero wraps the game key for it
  if (!isPublicKey(body?.publicKey)) throw createError({ statusCode: 400, message: 'Public key required' })
  // Per game code across all IPs: guessing a 6-digit PIN stays impractical even from many addresses
  rateLimit(event, 'join-code', 30, 60 * 1000, code)

  const db = useRelayDb()
  const game = db.prepare('SELECT id, dm_signing_public, dm_exchange_public FROM games WHERE code = ?').get(code) as
    { id: string, dm_signing_public: string, dm_exchange_public: string } | undefined
  const player = game
    ? db.prepare('SELECT id, name FROM players WHERE game_id = ? AND pin_hash = ?').get(game.id, pinHash(game.id, pin)) as { id: string, name: string } | undefined
    : undefined
  // Same answer for wrong code and wrong PIN - no hint which one was wrong
  if (!game || !player) throw createError({ statusCode: 401, message: 'Code or PIN is wrong' })

  const token = randomToken()
  db.prepare('INSERT INTO player_sessions (token_hash, game_id, player_id, created_at, public_key) VALUES (?, ?, ?, ?, ?)')
    .run(sha256(token), game.id, player.id, Date.now(), body!.publicKey!)
  setPlayerCookie(event, token)
  // DM public keys: the player needs them to verify the DM and receive the game key
  return {
    gameId: game.id,
    playerId: player.id,
    name: player.name,
    dmPublicKeys: { signing: game.dm_signing_public, exchange: game.dm_exchange_public },
  }
})
