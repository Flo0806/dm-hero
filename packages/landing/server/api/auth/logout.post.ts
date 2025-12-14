import { revokeRefreshToken, clearAuthCookies } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const refreshToken = getCookie(event, 'refresh_token')

  if (refreshToken) {
    await revokeRefreshToken(refreshToken)
  }

  clearAuthCookies(event)

  return { message: 'Logged out successfully' }
})
