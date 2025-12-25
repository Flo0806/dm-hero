import { query, queryOne } from '../../utils/db'
import { requireAuth } from '../../utils/requireAuth'

interface User {
  id: number
  email: string
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const { email } = body

  if (!email) {
    throw createError({
      statusCode: 400,
      message: 'Email confirmation is required',
    })
  }

  // Verify email matches
  const dbUser = await queryOne<User>(
    'SELECT id, email FROM users WHERE id = ?',
    [user.id],
  )

  if (!dbUser || dbUser.email.toLowerCase() !== email.toLowerCase().trim()) {
    throw createError({
      statusCode: 400,
      message: 'Email does not match your account',
    })
  }

  // Delete user - CASCADE will handle related data (adventures, tokens, etc.)
  await query('DELETE FROM users WHERE id = ?', [user.id])

  // Clear auth cookies
  deleteCookie(event, 'access_token')
  deleteCookie(event, 'refresh_token')

  return { success: true }
})
