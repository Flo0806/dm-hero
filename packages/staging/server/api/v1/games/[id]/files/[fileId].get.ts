import { readFileSync } from 'node:fs'

// A joined player downloads an encrypted file. File ids are random and never
// reused, so the browser may keep it forever (still only readable with the key).
export default defineEventHandler((event) => {
  const gameId = getRouterParam(event, 'id') ?? ''
  requirePlayer(event, gameId)
  const fileId = getRouterParam(event, 'fileId') ?? ''
  if (!useRelayDb().prepare('SELECT 1 FROM files WHERE game_id = ? AND id = ?').get(gameId, fileId)) {
    throw createError({ statusCode: 404, message: 'File not found' })
  }
  setResponseHeaders(event, {
    'content-type': 'application/octet-stream',
    'cache-control': 'private, max-age=31536000, immutable',
  })
  return readFileSync(filePath(gameId, fileId))
})
