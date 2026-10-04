// Live stream for DM Hero: who is online. DM Hero opens it (outgoing), so it works behind any router.
export default defineEventHandler((event) => {
  const game = requireDm(event, getRouterParam(event, 'id') ?? '')
  const stream = createEventStream(event)
  addDmStream(game.id, stream)
  stream.onClosed(async () => {
    removeDmStream(game.id, stream)
    await stream.close()
  })

  // Start streaming first, then send the current state (also flushes the headers)
  const sending = stream.send()
  void stream.push({ event: 'presence', data: JSON.stringify({ online: onlinePlayers(game.id) }) })

  // Devices that joined while DM Hero was away still wait for their game key
  const pending = useRelayDb().prepare(`
    SELECT DISTINCT player_id, public_key FROM player_sessions
    WHERE game_id = ? AND wrapped_key IS NULL AND public_key IS NOT NULL
  `).all(game.id) as Array<{ player_id: string, public_key: string }>
  for (const p of pending) {
    void stream.push({ event: 'key-request', data: JSON.stringify({ playerId: p.player_id, publicKey: p.public_key }) })
  }
  // Messages players wrote while DM Hero was away
  const inbox = useRelayDb().prepare('SELECT id, player_id, public_key, envelope, created_at FROM inbox WHERE game_id = ? ORDER BY created_at')
    .all(game.id) as Array<{ id: string, player_id: string, public_key: string, envelope: string, created_at: number }>
  for (const m of inbox) {
    void stream.push({ event: 'message', data: JSON.stringify({ id: m.id, playerId: m.player_id, publicKey: m.public_key, envelope: JSON.parse(m.envelope), sentAt: m.created_at }) })
  }
  return sending
})
