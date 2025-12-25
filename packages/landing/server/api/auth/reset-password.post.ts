import { query, queryOne } from '../../utils/db'
import { hashPassword } from '../../utils/auth'

interface TokenRecord {
  id: number
  user_id: number
  expires_at: Date
  used_at: Date | null
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { token, password } = body

  if (!token || !password) {
    throw createError({
      statusCode: 400,
      message: 'Token and password are required',
    })
  }

  if (password.length < 8) {
    throw createError({
      statusCode: 400,
      message: 'Password must be at least 8 characters',
    })
  }

  // Find token
  const tokenRecord = await queryOne<TokenRecord>(
    'SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token = ?',
    [token],
  )

  if (!tokenRecord) {
    throw createError({
      statusCode: 400,
      message: 'Invalid or expired token',
    })
  }

  // Check if already used
  if (tokenRecord.used_at) {
    throw createError({
      statusCode: 400,
      message: 'Token has already been used',
    })
  }

  // Check if expired
  if (new Date(tokenRecord.expires_at) < new Date()) {
    throw createError({
      statusCode: 400,
      message: 'Token has expired',
    })
  }

  // Hash new password
  const passwordHash = await hashPassword(password)

  // Update user password
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [
    passwordHash,
    tokenRecord.user_id,
  ])

  // Mark token as used
  await query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?', [
    tokenRecord.id,
  ])

  // Revoke all refresh tokens for this user (force re-login)
  await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [
    tokenRecord.user_id,
  ])

  return { success: true }
})
