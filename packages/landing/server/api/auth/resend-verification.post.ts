import { randomBytes } from 'crypto'
import { query, queryOne } from '../../utils/db'
import { sendVerificationEmail } from '../../utils/email'

interface ResendBody {
  email: string
  locale?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ResendBody>(event)

  if (!body.email) {
    throw createError({
      statusCode: 400,
      message: 'Email is required',
    })
  }

  // Find user by email
  const user = await queryOne<{
    id: number
    email: string
    email_verified: boolean
  }>('SELECT id, email, email_verified FROM users WHERE email = ?', [body.email.toLowerCase()])

  // Don't reveal if email exists or not for security
  if (!user) {
    return {
      success: true,
      message: 'If an account with this email exists, a verification email has been sent.',
    }
  }

  // Check if already verified
  if (user.email_verified) {
    return {
      success: true,
      message: 'This email is already verified.',
      alreadyVerified: true,
    }
  }

  // Invalidate old tokens
  await query('UPDATE email_verification_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [
    user.id,
  ])

  // Generate new token
  const verificationToken = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

  await query(
    'INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
    [user.id, verificationToken, expiresAt],
  )

  // Send verification email
  await sendVerificationEmail(user.email, verificationToken, body.locale || 'en')

  return {
    success: true,
    message: 'Verification email sent. Please check your inbox.',
  }
})
