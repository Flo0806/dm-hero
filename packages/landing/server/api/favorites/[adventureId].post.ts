import { query, queryOne } from '../../utils/db'
import { requireAuth } from '../../utils/requireAuth'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const adventureId = getRouterParam(event, 'adventureId')

  if (!adventureId || isNaN(Number(adventureId))) {
    throw createError({ statusCode: 400, message: 'Invalid adventure ID' })
  }

  // Check adventure exists and is published
  const adventure = await queryOne<{ id: number }>(
    'SELECT id FROM adventures WHERE id = ? AND status = ?',
    [adventureId, 'published'],
  )

  if (!adventure) {
    throw createError({ statusCode: 404, message: 'Adventure not found' })
  }

  // Add to favorites (ignore if already exists)
  await query(
    'INSERT IGNORE INTO user_favorites (user_id, adventure_id) VALUES (?, ?)',
    [user.id, adventureId],
  )

  return { success: true, isFavorite: true }
})
