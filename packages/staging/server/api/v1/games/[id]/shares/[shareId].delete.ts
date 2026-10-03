// DM Hero stops sharing something - players remove it live
export default defineEventHandler((event) => {
  const game = requireDm(event, getRouterParam(event, 'id') ?? '')
  const shareId = getRouterParam(event, 'shareId') ?? ''
  useRelayDb().prepare('DELETE FROM shares WHERE game_id = ? AND id = ?').run(game.id, shareId)
  sendToPlayers(game.id, 'unshare', { id: shareId })
  return { ok: true }
})
