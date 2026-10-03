// Game-wide content, one per slot: the map shown to the players and its fog of war.
// Encrypted like shares - the relay can't read it.
const STATE_SLOTS = ['map', 'fog'] as const
// A fog with many brush strokes gets bigger than a share
const MAX_ENVELOPE_BYTES = 1024 * 1024

export default defineEventHandler(async (event) => {
  const game = requireDm(event, getRouterParam(event, 'id') ?? '')
  const slot = getRouterParam(event, 'slot') ?? ''
  if (!(STATE_SLOTS as readonly string[]).includes(slot)) throw createError({ statusCode: 400, message: 'Unknown slot' })

  const envelope = await readBody<{ header?: object, iv?: string, ciphertext?: string, signature?: string }>(event)
  const json = JSON.stringify(envelope)
  const valid = typeof envelope?.header === 'object' && typeof envelope.iv === 'string'
    && typeof envelope.ciphertext === 'string' && typeof envelope.signature === 'string'
  if (!valid) throw createError({ statusCode: 400, message: 'Encrypted envelope required' })
  if (json.length > MAX_ENVELOPE_BYTES) throw createError({ statusCode: 413, message: 'Too large' })

  useRelayDb().prepare(`
    INSERT INTO game_state (game_id, slot, envelope, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT (game_id, slot) DO UPDATE SET envelope = excluded.envelope, updated_at = excluded.updated_at
  `).run(game.id, slot, json, Date.now())

  sendToPlayers(game.id, 'state', { slot, envelope })
  return { ok: true }
})
