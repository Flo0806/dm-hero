import { verifyAccessToken, getUserById, clearAuthCookies } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const accessToken = getCookie(event, 'access_token')

  if (!accessToken) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated',
    })
  }

  const payload = verifyAccessToken(accessToken)

  if (!payload) {
    clearAuthCookies(event)
    throw createError({
      statusCode: 401,
      message: 'Invalid or expired token',
    })
  }

  const user = await getUserById(payload.userId)

  if (!user) {
    clearAuthCookies(event)
    throw createError({
      statusCode: 401,
      message: 'User not found',
    })
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      role: user.role,
      emailVerified: user.email_verified,
    },
  }
})
