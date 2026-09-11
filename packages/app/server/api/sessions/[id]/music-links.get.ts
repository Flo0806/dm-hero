import { getDb } from '../../../utils/db'
import { parseMusicLinks } from '../../../utils/music-links'

export default defineEventHandler((event) => {
  const db = getDb()
  const sessionId = Number(getRouterParam(event, 'id'))
  if (!sessionId) {
    throw createError({ statusCode: 400, message: 'Session ID is required' })
  }

  const row = db.prepare('SELECT music_links FROM sessions WHERE id = ? AND deleted_at IS NULL').get(sessionId) as { music_links: string } | undefined
  if (!row) {
    throw createError({ statusCode: 404, message: 'Session not found' })
  }

  return parseMusicLinks(row.music_links)
})
