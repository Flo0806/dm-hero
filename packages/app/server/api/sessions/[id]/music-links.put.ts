import { getDb } from '../../../utils/db'
import { sanitizeMusicLinks } from '../../../utils/music-links'

/** Replace the whole playlist of a session */
export default defineEventHandler(async (event) => {
  const db = getDb()
  const sessionId = Number(getRouterParam(event, 'id'))
  if (!sessionId) {
    throw createError({ statusCode: 400, message: 'Session ID is required' })
  }

  const body = await readBody<{ links: unknown }>(event)
  const links = sanitizeMusicLinks(body?.links)

  const result = db
    .prepare('UPDATE sessions SET music_links = ?, updated_at = datetime(\'now\') WHERE id = ? AND deleted_at IS NULL')
    .run(JSON.stringify(links), sessionId)
  if (result.changes === 0) {
    throw createError({ statusCode: 404, message: 'Session not found' })
  }

  return links
})
