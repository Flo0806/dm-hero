// DM rejected a device: its sessions end and its connections close (other devices of the player stay)
export default defineEventHandler(async (event) => {
  const game = requireDm(event, getRouterParam(event, 'id') ?? '')
  const body = await readBody<{ playerId?: string, publicKey?: string }>(event)
  if (typeof body?.playerId !== 'string' || !isPublicKey(body.publicKey)) {
    throw createError({ statusCode: 400, message: 'playerId and publicKey required' })
  }

  useRelayDb().prepare('DELETE FROM player_sessions WHERE game_id = ? AND player_id = ? AND public_key = ?')
    .run(game.id, body.playerId, body.publicKey)
  await disconnectDevice(game.id, body.playerId, body.publicKey)
  return { ok: true }
})
