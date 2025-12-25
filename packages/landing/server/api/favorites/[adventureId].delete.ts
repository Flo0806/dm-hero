import { query } from '../../utils/db'
import { requireAuth } from '../../utils/requireAuth'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const adventureId = getRouterParam(event, 'adventureId')

  if (!adventureId || isNaN(Number(adventureId))) {
    throw createError({ statusCode: 400, message: 'Invalid adventure ID' })
  }

  await query(
    'DELETE FROM user_favorites WHERE user_id = ? AND adventure_id = ?',
    [user.id, adventureId],
  )

  return { success: true, isFavorite: false }
})
