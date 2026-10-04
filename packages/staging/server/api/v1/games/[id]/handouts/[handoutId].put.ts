// DM Hero shares (or updates) a handout for chosen players.
// Body: { players: { [playerId]: { [devicePublicKey]: envelope } } } - one envelope per
// device, sealed with that device's pair key. Only recipients get it, nobody else sees it exists.
const MAX_BODY_BYTES = 1024 * 1024
const MAX_HANDOUTS_PER_GAME = 100

type Envelopes = Record<string, Record<string, unknown>>

export default defineEventHandler(async (event) => {
  const game = requireDm(event, getRouterParam(event, 'id') ?? '')
  const handoutId = getRouterParam(event, 'handoutId') ?? ''
  if (!/^[\w-]{1,64}$/.test(handoutId)) throw createError({ statusCode: 400, message: 'Invalid handout id' })

  const body = await readBody<{ players?: Envelopes }>(event)
  const players = body?.players
  const valid = !!players && typeof players === 'object' && Object.entries(players).every(([id, devices]) =>
    /^[\w-]{1,64}$/.test(id) && !!devices && typeof devices === 'object'
    && Object.values(devices).every(e => typeof (e as { ciphertext?: unknown })?.ciphertext === 'string'))
  if (!valid) throw createError({ statusCode: 400, message: 'Encrypted envelopes per player required' })
  if (JSON.stringify(body).length > MAX_BODY_BYTES) throw createError({ statusCode: 413, message: 'Handout too large' })

  const db = useRelayDb()
  const exists = db.prepare('SELECT 1 FROM handouts WHERE game_id = ? AND id = ?').get(game.id, handoutId)
  const count = (db.prepare('SELECT COUNT(DISTINCT id) AS n FROM handouts WHERE game_id = ?').get(game.id) as { n: number }).n
  if (!exists && count >= MAX_HANDOUTS_PER_GAME) throw createError({ statusCode: 413, message: 'Too many handouts in this game' })

  // Players no longer on the list lose it live
  const before = (db.prepare('SELECT player_id FROM handouts WHERE game_id = ? AND id = ?').all(game.id, handoutId) as Array<{ player_id: string }>)
    .map(row => row.player_id)
  // All or nothing: a failed insert keeps the previous recipients
  const insert = db.prepare('INSERT INTO handouts (game_id, id, player_id, envelopes, updated_at) VALUES (?, ?, ?, ?, ?)')
  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM handouts WHERE game_id = ? AND id = ?').run(game.id, handoutId)
    for (const [playerId, devices] of Object.entries(players!)) insert.run(game.id, handoutId, playerId, JSON.stringify(devices), Date.now())
    db.exec('COMMIT')
  }
  catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  for (const playerId of before.filter(id => !(id in players!))) sendToPlayer(game.id, playerId, 'unhandout', { id: handoutId })
  for (const [playerId, devices] of Object.entries(players!)) {
    sendToPlayerDevices(game.id, playerId, 'handout', publicKey => (publicKey && devices[publicKey] ? { id: handoutId, envelope: devices[publicKey] } : null))
  }
  return { ok: true }
})
