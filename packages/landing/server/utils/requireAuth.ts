import type { H3Event } from 'h3'
import { verifyAccessToken, getUserById, type User } from './auth'

export interface AuthenticatedEvent extends H3Event {
  context: H3Event['context'] & {
    user: User
  }
}

export async function requireAuth(event: H3Event): Promise<User> {
  const accessToken = getCookie(event, 'access_token')

  if (!accessToken) {
    throw createError({
      statusCode: 401,
      message: 'Authentication required',
    })
  }

  const payload = verifyAccessToken(accessToken)

  if (!payload) {
    throw createError({
      statusCode: 401,
      message: 'Invalid or expired token',
    })
  }

  const user = await getUserById(payload.userId)

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'User not found',
    })
  }

  // Attach user to event context
  event.context.user = user

  return user
}

export async function requireRole(event: H3Event, roles: Array<'user' | 'creator' | 'admin'>): Promise<User> {
  const user = await requireAuth(event)

  if (!roles.includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: 'Insufficient permissions',
    })
  }

  return user
}
