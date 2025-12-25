import { randomBytes } from 'crypto'
import { query, queryOne } from '../../utils/db'
import { sendPasswordResetEmail } from '../../utils/email'

interface User {
  id: number
  email: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, locale = 'en' } = body

  if (!email) {
    throw createError({
      statusCode: 400,
      message: 'Email is required',
    })
  }

  // Find user by email
  const user = await queryOne<User>(
    'SELECT id, email FROM users WHERE email = ?',
    [email.toLowerCase().trim()],
  )

  // Always return success to prevent email enumeration attacks
  if (!user) {
    return { success: true }
  }

  // Delete any existing tokens for this user
  await query('DELETE FROM password_reset_tokens WHERE user_id = ?', [user.id])

  // Generate secure random token
  const token = randomBytes(32).toString('hex')

  // Store token with 1-hour expiry
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
  await query(
    'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
    [user.id, token, expiresAt],
  )

  // Send password reset email
  await sendPasswordResetEmail(user.email, token, locale)

  return { success: true }
})
