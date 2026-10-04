import { randomUUID } from 'node:crypto'

// A player writes to the DM: sealed with the device's pair key - only DM Hero can
// read it. Kept in the inbox until DM Hero picked it up (it may be offline).
const MAX_ENVELOPE_BYTES = 8 * 1024
const MAX_INBOX_PER_GAME = 500

export default defineEventHandler(async (event) => {
  const gameId = getRouterParam(event, 'id') ?? ''
  const player = requirePlayer(event, gameId)
  rateLimit(event, 'message', 10, 60_000, `${gameId}:${player.player_id}`)
  if (!player.public_key) throw createError({ statusCode: 400, message: 'Device key required' })

  const envelope = await readBody<{ header?: object, iv?: string, ciphertext?: string }>(event)
  const valid = typeof envelope?.header === 'object' && typeof envelope.iv === 'string' && typeof envelope.ciphertext === 'string'
  if (!valid || JSON.stringify(envelope).length > MAX_ENVELOPE_BYTES) throw createError({ statusCode: 400, message: 'Encrypted message required' })

  const db = useRelayDb()
  if ((db.prepare('SELECT COUNT(*) AS n FROM inbox WHERE game_id = ?').get(gameId) as { n: number }).n >= MAX_INBOX_PER_GAME) {
    throw createError({ statusCode: 429, message: 'Too many unread messages - the DM picks them up when back' })
  }

  const id = randomUUID()
  const sentAt = Date.now()
  const clean = { header: envelope.header, iv: envelope.iv, ciphertext: envelope.ciphertext }
  db.prepare('INSERT INTO inbox (game_id, id, player_id, public_key, envelope, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(gameId, id, player.player_id, player.public_key, JSON.stringify(clean), sentAt)
  sendToDm(gameId, 'message', { id, playerId: player.player_id, publicKey: player.public_key, envelope: clean, sentAt })
  return { ok: true }
})
