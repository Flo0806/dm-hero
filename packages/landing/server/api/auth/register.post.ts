import { randomBytes } from 'crypto'
import { query, queryOne } from '../../utils/db'
import { hashPassword, getUserById } from '../../utils/auth'
import { sendVerificationEmail } from '../../utils/email'

interface RegisterBody {
  email: string
  password: string
  displayName: string
  locale?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<RegisterBody>(event)

  // Validation
  if (!body.email || !body.password || !body.displayName) {
    throw createError({
      statusCode: 400,
      message: 'Email, password and display name are required',
    })
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(body.email)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid email format',
    })
  }

  // Password strength
  if (body.password.length < 8) {
    throw createError({
      statusCode: 400,
      message: 'Password must be at least 8 characters',
    })
  }

  // Display name validation
  if (body.displayName.length < 2 || body.displayName.length > 100) {
    throw createError({
      statusCode: 400,
      message: 'Display name must be between 2 and 100 characters',
    })
  }

  // Check if email already exists
  const existing = await queryOne<{ id: number }>(
    'SELECT id FROM users WHERE email = ?',
    [body.email.toLowerCase()],
  )

  if (existing) {
    throw createError({
      statusCode: 409,
      message: 'Email already registered',
    })
  }

  // Hash password and create user
  const passwordHash = await hashPassword(body.password)

  const result = await query<{ insertId: number }>(
    'INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)',
    [body.email.toLowerCase(), passwordHash, body.displayName],
  )

  const userId = (result as unknown as { insertId: number }).insertId
  const user = await getUserById(userId)

  if (!user) {
    throw createError({
      statusCode: 500,
      message: 'Failed to create user',
    })
  }

  // DON'T auto-login - user must verify email first
  // No cookies are set here

  // Generate email verification token
  const verificationToken = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

  await query(
    'INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
    [userId, verificationToken, expiresAt],
  )

  // Send verification email (don't wait, don't fail registration if email fails)
  sendVerificationEmail(user.email, verificationToken, body.locale || 'en').catch((err) => {
    console.error('[Register] Failed to send verification email:', err)
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
    message: 'Registration successful. Please check your email to verify your account.',
    requiresVerification: true,
  }
})
