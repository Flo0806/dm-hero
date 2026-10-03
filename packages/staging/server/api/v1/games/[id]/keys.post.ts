interface WrappedKeyInput {
  playerId?: string
  publicKey?: string
  envelope?: { header?: object, iv?: string, ciphertext?: string, signature?: string }
}

// DM Hero delivers the game key, wrapped for one device. The relay can't open it.
export default defineEventHandler(async (event) => {
  const game = requireDm(event, getRouterParam(event, 'id') ?? '')
  const body = await readBody<WrappedKeyInput>(event)
  const env = body?.envelope
  const valid = typeof body?.playerId === 'string' && isPublicKey(body.publicKey)
    && typeof env?.header === 'object' && typeof env.iv === 'string' && typeof env.ciphertext === 'string'
    && typeof env.signature === 'string' && JSON.stringify(env).length < 4096
  if (!valid) throw createError({ statusCode: 400, message: 'Invalid wrapped key' })

  const result = useRelayDb().prepare(`
    UPDATE player_sessions SET wrapped_key = ?
    WHERE game_id = ? AND player_id = ? AND public_key = ?
  `).run(JSON.stringify(env), game.id, body!.playerId!, body!.publicKey!)
  if (result.changes === 0) throw createError({ statusCode: 404, message: 'No such device in this game' })

  sendToPlayer(game.id, body!.playerId!, 'game-key', { publicKey: body!.publicKey, envelope: env })
  return { ok: true }
})
