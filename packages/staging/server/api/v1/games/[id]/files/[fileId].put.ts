import { writeFileSync } from 'node:fs'

// DM Hero uploads an encrypted file (raw bytes). Limits per file and per game.
export default defineEventHandler(async (event) => {
  const game = requireDm(event, getRouterParam(event, 'id') ?? '')
  const fileId = getRouterParam(event, 'fileId') ?? ''
  const path = filePath(game.id, fileId)

  const length = Number(getHeader(event, 'content-length') ?? 0)
  if (length > MAX_FILE_BYTES) throw createError({ statusCode: 413, message: 'File too large' })
  const body = await readRawBody(event, false)
  if (!body?.length) throw createError({ statusCode: 400, message: 'File content required' })
  if (body.length > MAX_FILE_BYTES) throw createError({ statusCode: 413, message: 'File too large' })

  const db = useRelayDb()
  const used = (db.prepare('SELECT COALESCE(SUM(size), 0) AS n FROM files WHERE game_id = ? AND id != ?').get(game.id, fileId) as { n: number }).n
  if (used + body.length > MAX_GAME_BYTES) throw createError({ statusCode: 413, message: 'Storage limit of this game reached' })

  ensureGameDir(game.id)
  writeFileSync(path, body)
  db.prepare(`
    INSERT INTO files (game_id, id, size, created_at) VALUES (?, ?, ?, ?)
    ON CONFLICT (game_id, id) DO UPDATE SET size = excluded.size
  `).run(game.id, fileId, body.length, Date.now())
  return { ok: true, used: used + body.length, limit: MAX_GAME_BYTES }
})
