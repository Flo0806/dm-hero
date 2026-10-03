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
  return sending
})
