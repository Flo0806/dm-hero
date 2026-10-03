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
  return sending
})
