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
  void stream.push({ event: 'ready', data: JSON.stringify({ name: player.name }) })

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
  return sending
})
