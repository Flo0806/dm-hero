// DM Hero pings a spot on the shown map (encrypted + signed by the DM)
export default defineEventHandler(async (event) => {
  const game = requireDm(event, getRouterParam(event, 'id') ?? '')
  rateLimit(event, 'dm-ping', 20, 10_000, game.id)

  const envelope = await readBody<{ header?: object, iv?: string, ciphertext?: string, signature?: string }>(event)
  const valid = typeof envelope?.header === 'object' && typeof envelope.iv === 'string'
    && typeof envelope.ciphertext === 'string' && typeof envelope.signature === 'string'
  if (!valid || JSON.stringify(envelope).length > 2048) throw createError({ statusCode: 400, message: 'Encrypted ping required' })

  sendToPlayers(game.id, 'ping', { from: 'dm', envelope })
  return { ok: true }
})
