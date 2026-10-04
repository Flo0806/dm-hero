// DM Hero sends the conversation with one player: one envelope per device of
// that player (pair key). Replaces the previous one; only that player gets it.
const MAX_BODY_BYTES = 1024 * 1024

export default defineEventHandler(async (event) => {
  const game = requireDm(event, getRouterParam(event, 'id') ?? '')
  const playerId = getRouterParam(event, 'playerId') ?? ''
  if (!/^[\w-]{1,64}$/.test(playerId)) throw createError({ statusCode: 400, message: 'Invalid player id' })

  const body = await readBody<{ envelopes?: Record<string, unknown> }>(event)
  const envelopes = body?.envelopes
  const valid = !!envelopes && typeof envelopes === 'object'
    && Object.values(envelopes).every(e => typeof (e as { ciphertext?: unknown })?.ciphertext === 'string')
  if (!valid) throw createError({ statusCode: 400, message: 'Encrypted envelopes per device required' })
  if (JSON.stringify(body).length > MAX_BODY_BYTES) throw createError({ statusCode: 413, message: 'Conversation too large' })

  useRelayDb().prepare(`
    INSERT INTO threads (game_id, player_id, envelopes, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT (game_id, player_id) DO UPDATE SET envelopes = excluded.envelopes, updated_at = excluded.updated_at
  `).run(game.id, playerId, JSON.stringify(envelopes), Date.now())

  sendToPlayerDevices(game.id, playerId, 'thread', publicKey => (publicKey && envelopes![publicKey] ? { envelope: envelopes![publicKey] } : null))
  return { ok: true }
})
