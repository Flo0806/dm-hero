import { query, queryOne } from '../../utils/db'
import {
  hashPassword,
  generateAccessToken,
  generateRefreshToken,
  setAuthCookies,
  getUserById,
} from '../../utils/auth'

interface RegisterBody {
  email: string
  password: string
  displayName: string
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

  // Generate tokens
  const accessToken = generateAccessToken(user)
  const refreshToken = await generateRefreshToken(user.id)

  // Set cookies
  setAuthCookies(event, accessToken, refreshToken)

  // TODO: Send verification email

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      role: user.role,
      emailVerified: user.email_verified,
    },
    message: 'Registration successful',
  }
})
