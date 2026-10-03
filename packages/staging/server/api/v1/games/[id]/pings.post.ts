// A player pings a spot on the shown map. Encrypted (game key) - the relay only
// adds who it came from, so nobody can ping under another player's name.
// Not stored: a ping is a moment.
export default defineEventHandler(async (event) => {
  const gameId = getRouterParam(event, 'id') ?? ''
  const player = requirePlayer(event, gameId)
  rateLimit(event, 'ping', 10, 10_000, `${gameId}:${player.player_id}`)

  const envelope = await readBody<{ header?: object, iv?: string, ciphertext?: string }>(event)
  const valid = typeof envelope?.header === 'object' && typeof envelope.iv === 'string' && typeof envelope.ciphertext === 'string'
  if (!valid || JSON.stringify(envelope).length > 2048) throw createError({ statusCode: 400, message: 'Encrypted ping required' })

  const ping = { from: player.player_id, name: player.name, envelope: { header: envelope.header, iv: envelope.iv, ciphertext: envelope.ciphertext } }
  sendToPlayers(gameId, 'ping', ping)
  sendToDm(gameId, 'ping', ping)
  return { ok: true }
})
