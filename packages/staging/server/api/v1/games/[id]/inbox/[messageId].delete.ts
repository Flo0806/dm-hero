// DM Hero has stored a player's message - it leaves the relay
export default defineEventHandler((event) => {
  const game = requireDm(event, getRouterParam(event, 'id') ?? '')
  useRelayDb().prepare('DELETE FROM inbox WHERE game_id = ? AND id = ?').run(game.id, getRouterParam(event, 'messageId') ?? '')
  return { ok: true }
})
