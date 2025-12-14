import {
  getUserByEmail,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  setAuthCookies,
} from '../../utils/auth'

interface LoginBody {
  email: string
  password: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<LoginBody>(event)

  if (!body.email || !body.password) {
    throw createError({
      statusCode: 400,
      message: 'Email and password are required',
    })
  }

  // Find user
  const user = await getUserByEmail(body.email.toLowerCase())

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Invalid email or password',
    })
  }

  // Verify password
  const validPassword = await verifyPassword(body.password, user.password_hash)

  if (!validPassword) {
    throw createError({
      statusCode: 401,
      message: 'Invalid email or password',
    })
  }

  // Check if email is verified
  if (!user.email_verified) {
    throw createError({
      statusCode: 403,
      statusMessage: 'email_not_verified',
      message: 'Please verify your email address before logging in',
    })
  }

  // Generate tokens
  const accessToken = generateAccessToken(user)
  const refreshToken = await generateRefreshToken(user.id)

  // Set cookies
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
