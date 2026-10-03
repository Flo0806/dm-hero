// Live stream for a joined player
export default defineEventHandler((event) => {
  const gameId = getRouterParam(event, 'id') ?? ''
  const player = requirePlayer(event, gameId)
  const stream = createEventStream(event)
  addPlayerStream(gameId, player.player_id, stream)
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
  return sending
})
