import {
  verifyRefreshToken,
  revokeRefreshToken,
  getUserById,
  generateAccessToken,
  generateRefreshToken,
  setAuthCookies,
  clearAuthCookies,
} from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const oldRefreshToken = getCookie(event, 'refresh_token')

  if (!oldRefreshToken) {
    throw createError({
      statusCode: 401,
      message: 'No refresh token provided',
    })
  }

  // Verify refresh token
  const userId = await verifyRefreshToken(oldRefreshToken)

  if (!userId) {
    clearAuthCookies(event)
    throw createError({
      statusCode: 401,
      message: 'Invalid or expired refresh token',
    })
  }

  // Revoke old refresh token (rotation)
  await revokeRefreshToken(oldRefreshToken)

  // Get user
  const user = await getUserById(userId)

  if (!user) {
    clearAuthCookies(event)
    throw createError({
      statusCode: 401,
      message: 'User not found',
    })
  }

  // Generate new tokens
  const accessToken = generateAccessToken(user)
  const refreshToken = await generateRefreshToken(user.id)

  // Set new cookies
  setAuthCookies(event, accessToken, refreshToken)

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
