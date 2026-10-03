// Limits keep a public relay from being used as free storage
const MAX_ENVELOPE_BYTES = 256 * 1024
const MAX_SHARES_PER_GAME = 500

// DM Hero shares (or updates) something. The envelope is encrypted - the relay can't read it.
export default defineEventHandler(async (event) => {
  const game = requireDm(event, getRouterParam(event, 'id') ?? '')
  const shareId = getRouterParam(event, 'shareId') ?? ''
  if (!/^[\w-]{1,64}$/.test(shareId)) throw createError({ statusCode: 400, message: 'Invalid share id' })

  const envelope = await readBody<{ header?: object, iv?: string, ciphertext?: string, signature?: string }>(event)
  const json = JSON.stringify(envelope)
  const valid = typeof envelope?.header === 'object' && typeof envelope.iv === 'string'
    && typeof envelope.ciphertext === 'string' && typeof envelope.signature === 'string'
  if (!valid) throw createError({ statusCode: 400, message: 'Encrypted envelope required' })
  if (json.length > MAX_ENVELOPE_BYTES) throw createError({ statusCode: 413, message: 'Share too large' })

  const db = useRelayDb()
  const exists = db.prepare('SELECT 1 FROM shares WHERE game_id = ? AND id = ?').get(game.id, shareId)
  if (!exists && (db.prepare('SELECT COUNT(*) AS n FROM shares WHERE game_id = ?').get(game.id) as { n: number }).n >= MAX_SHARES_PER_GAME) {
    throw createError({ statusCode: 413, message: 'Too many shares in this game' })
  }

  db.prepare(`
    INSERT INTO shares (game_id, id, envelope, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT (game_id, id) DO UPDATE SET envelope = excluded.envelope, updated_at = excluded.updated_at
  `).run(game.id, shareId, json, Date.now())

  sendToPlayers(game.id, 'share', { id: shareId, envelope })
  return { ok: true }
})
