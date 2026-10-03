interface PlayerInput {
  id: string
  name: string
  pinHash: string
}

const MAX_PLAYERS = 50

// DM Hero sends the full player list. Removed players and players with a new PIN are kicked.
export default defineEventHandler(async (event) => {
  const game = requireDm(event, getRouterParam(event, 'id') ?? '')
  const body = await readBody<{ players?: PlayerInput[] }>(event)
  const players = body?.players
  const valid = Array.isArray(players)
    && players.length <= MAX_PLAYERS
    && players.every(p => typeof p?.id === 'string' && p.id && typeof p.name === 'string' && p.name.trim()
      && typeof p.pinHash === 'string' && /^[a-f0-9]{64}$/.test(p.pinHash))
  if (!valid) throw createError({ statusCode: 400, message: 'Invalid player list' })

  const db = useRelayDb()
  const before = new Map(
    (db.prepare('SELECT id, pin_hash FROM players WHERE game_id = ?').all(game.id) as Array<{ id: string, pin_hash: string }>)
      .map(p => [p.id, p.pin_hash]),
  )
  const kicked = [...before.entries()]
    .filter(([id, hash]) => players!.find(p => p.id === id)?.pinHash !== hash)
    .map(([id]) => id)

  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM players WHERE game_id = ?').run(game.id)
    const insert = db.prepare('INSERT INTO players (game_id, id, name, pin_hash) VALUES (?, ?, ?, ?)')
    for (const p of players!) insert.run(game.id, p.id, p.name.trim(), p.pinHash)
    const dropSessions = db.prepare('DELETE FROM player_sessions WHERE game_id = ? AND player_id = ?')
    for (const id of kicked) dropSessions.run(game.id, id)
    db.exec('COMMIT')
  }
  catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  await disconnectPlayers(game.id, kicked)
  return { ok: true, players: players!.length }
})
