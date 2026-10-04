// Live stream for a joined player
export default defineEventHandler((event) => {
  const gameId = getRouterParam(event, 'id') ?? ''
  const player = requirePlayer(event, gameId)
  const stream = createEventStream(event)
  addPlayerStream(gameId, player.player_id, stream, player.public_key)
  stream.onClosed(async () => {
    removePlayerStream(gameId, player.player_id, stream)
    await stream.close()
  })

  const sending = stream.send()
  void stream.push({ event: 'ready', data: JSON.stringify({ name: player.name, playerId: player.player_id }) })

  // Game key: deliver if DM Hero already wrapped it for this device, otherwise ask DM Hero
  if (player.wrapped_key) {
    void stream.push({ event: 'game-key', data: JSON.stringify({ publicKey: player.public_key, envelope: JSON.parse(player.wrapped_key) }) })
  }
  else if (player.public_key) {
    sendToDm(gameId, 'key-request', { playerId: player.player_id, publicKey: player.public_key })
  }

  // Everything currently shared (encrypted) - the player decrypts once it has the game key
  const shares = useRelayDb().prepare('SELECT id, envelope FROM shares WHERE game_id = ? ORDER BY updated_at')
    .all(gameId) as Array<{ id: string, envelope: string }>
  for (const share of shares) {
    void stream.push({ event: 'share', data: JSON.stringify({ id: share.id, envelope: JSON.parse(share.envelope) }) })
  }
  // Handouts for this player - only the envelope of this device
  const handouts = useRelayDb().prepare('SELECT id, envelopes FROM handouts WHERE game_id = ? AND player_id = ? ORDER BY updated_at')
    .all(gameId, player.player_id) as Array<{ id: string, envelopes: string }>
  for (const handout of handouts) {
    const envelope = player.public_key ? (JSON.parse(handout.envelopes) as Record<string, unknown>)[player.public_key] : undefined
    if (envelope) void stream.push({ event: 'handout', data: JSON.stringify({ id: handout.id, envelope }) })
  }

  // The shown map + its fog
  const states = useRelayDb().prepare('SELECT slot, envelope FROM game_state WHERE game_id = ?')
    .all(gameId) as Array<{ slot: string, envelope: string }>
  for (const state of states) {
    void stream.push({ event: 'state', data: JSON.stringify({ slot: state.slot, envelope: JSON.parse(state.envelope) }) })
  }
  return sending
})
