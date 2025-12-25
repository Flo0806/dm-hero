import { queryOne } from '../../../../utils/db'
import { verifyAccessToken, getUserById } from '../../../../utils/auth'

export default defineEventHandler(async (event) => {
  // Optional auth - don't throw if not logged in
  const accessToken = getCookie(event, 'access_token')
  if (!accessToken) {
    return { rating: null }
  }

  const payload = verifyAccessToken(accessToken)
  if (!payload) {
    return { rating: null }
  }

  const user = await getUserById(payload.userId)
  if (!user) {
    return { rating: null }
  }

  const adventureId = getRouterParam(event, 'slug')
  if (!adventureId || isNaN(Number(adventureId))) {
    throw createError({ statusCode: 400, message: 'Invalid adventure ID' })
  }

  const result = await queryOne<{ rating: number }>(
    'SELECT rating FROM adventure_ratings WHERE adventure_id = ? AND user_id = ?',
    [adventureId, user.id],
  )

  return {
    rating: result?.rating || null,
  }
})
