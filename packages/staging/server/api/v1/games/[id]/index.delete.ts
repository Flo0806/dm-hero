// DM Hero ends the game: everything about it is removed
export default defineEventHandler(async (event) => {
  const game = requireDm(event, getRouterParam(event, 'id') ?? '')
  useRelayDb().prepare('DELETE FROM games WHERE id = ?').run(game.id)
  removeGameFiles(game.id)
  await closeGame(game.id)
  return { ok: true }
})
