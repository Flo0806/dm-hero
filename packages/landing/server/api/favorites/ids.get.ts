import { query } from '../../utils/db'
import { requireAuth } from '../../utils/requireAuth'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const favorites = await query<{ adventure_id: number }[]>(
    'SELECT adventure_id FROM user_favorites WHERE user_id = ?',
    [user.id],
  )

  return {
    favoriteIds: favorites.map((f) => f.adventure_id),
  }
})
