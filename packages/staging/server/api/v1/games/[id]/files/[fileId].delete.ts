import { rmSync } from 'node:fs'

// DM Hero removes a file it no longer uses (image changed, share withdrawn)
export default defineEventHandler((event) => {
  const game = requireDm(event, getRouterParam(event, 'id') ?? '')
  const fileId = getRouterParam(event, 'fileId') ?? ''
  rmSync(filePath(game.id, fileId), { force: true })
  useRelayDb().prepare('DELETE FROM files WHERE game_id = ? AND id = ?').run(game.id, fileId)
  return { ok: true }
})
