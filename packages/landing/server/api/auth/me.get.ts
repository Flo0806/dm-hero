import {
  verifyAccessToken,
  getUserById,
  clearAuthCookies,
  verifyRefreshToken,
  generateAccessToken,
} from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const accessToken = getCookie(event, 'access_token')
  const refreshToken = getCookie(event, 'refresh_token')

  // Try to verify access token first
  if (accessToken) {
    const payload = verifyAccessToken(accessToken)

    if (payload) {
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
    }
  }

  // Access token missing or invalid - try silent refresh with refresh token
  if (!refreshToken) {
    clearAuthCookies(event)
    throw createError({
      statusCode: 401,
      message: 'Not authenticated',
    })
  }

  // Silent refresh: verify refresh token and issue new access token
  const userId = await verifyRefreshToken(refreshToken)

  if (!userId) {
    clearAuthCookies(event)
    throw createError({
      statusCode: 401,
      message: 'Session expired',
    })
  }

  const user = await getUserById(userId)

  if (!user) {
    clearAuthCookies(event)
    throw createError({
      statusCode: 401,
      message: 'User not found',
    })
  }

  // Generate new access token only - DO NOT revoke/rotate refresh token here!
  // During SSR, cookies set in internal $fetch calls don't reach the browser.
  // If we revoke the refresh token, the client will have an invalid token.
  // Token rotation happens in /api/auth/refresh which is called client-side.
  const newAccessToken = generateAccessToken(user)

  // Only set the new access token cookie (refresh token stays the same)
  setCookie(event, 'access_token', newAccessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60, // 15 minutes
    path: '/',
  })

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
