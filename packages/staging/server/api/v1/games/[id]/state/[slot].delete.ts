// DM Hero stops showing the map (or its fog) - players drop it live
export default defineEventHandler((event) => {
  const game = requireDm(event, getRouterParam(event, 'id') ?? '')
  const slot = getRouterParam(event, 'slot') ?? ''
  useRelayDb().prepare('DELETE FROM game_state WHERE game_id = ? AND slot = ?').run(game.id, slot)
  sendToPlayers(game.id, 'state', { slot, envelope: null })
  return { ok: true }
})
