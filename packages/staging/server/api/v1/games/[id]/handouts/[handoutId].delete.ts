// DM Hero withdraws a handout - its recipients drop it live
export default defineEventHandler((event) => {
  const game = requireDm(event, getRouterParam(event, 'id') ?? '')
  const handoutId = getRouterParam(event, 'handoutId') ?? ''
  const db = useRelayDb()
  const players = db.prepare('SELECT player_id FROM handouts WHERE game_id = ? AND id = ?').all(game.id, handoutId) as Array<{ player_id: string }>
  db.prepare('DELETE FROM handouts WHERE game_id = ? AND id = ?').run(game.id, handoutId)
  for (const { player_id } of players) sendToPlayer(game.id, player_id, 'unhandout', { id: handoutId })
  return { ok: true }
})
