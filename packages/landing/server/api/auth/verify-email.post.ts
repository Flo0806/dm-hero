import { query, queryOne } from '../../utils/db'

interface VerifyBody {
  token: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<VerifyBody>(event)

  if (!body.token) {
    throw createError({
      statusCode: 400,
      message: 'Verification token is required',
    })
  }

  // Find the token
  const tokenRecord = await queryOne<{
    id: number
    user_id: number
    expires_at: Date
    used_at: Date | null
  }>(
    'SELECT id, user_id, expires_at, used_at FROM email_verification_tokens WHERE token = ?',
    [body.token],
  )

  if (!tokenRecord) {
    throw createError({
      statusCode: 400,
      message: 'Invalid verification token',
    })
  }

  // Check if already used
  if (tokenRecord.used_at) {
    throw createError({
      statusCode: 400,
      message: 'This verification link has already been used',
    })
  }

  // Check if expired
  if (new Date(tokenRecord.expires_at) < new Date()) {
    throw createError({
      statusCode: 400,
      message: 'This verification link has expired. Please request a new one.',
    })
  }

  // Mark token as used and verify user
  await query('UPDATE email_verification_tokens SET used_at = NOW() WHERE id = ?', [
    tokenRecord.id,
  ])

  await query('UPDATE users SET email_verified = TRUE WHERE id = ?', [tokenRecord.user_id])

  // Get updated user info
  const user = await queryOne<{
    id: number
    email: string
    display_name: string
    role: string
  }>('SELECT id, email, display_name, role FROM users WHERE id = ?', [tokenRecord.user_id])

  return {
    success: true,
    message: 'Email verified successfully',
    user: user
      ? {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          role: user.role,
        }
      : null,
  }
})
