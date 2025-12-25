import type { H3Event } from 'h3'
import { verifyAccessToken, getUserById, type User } from './auth'
import { hasAcceptedCurrentTos } from './tos'

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

/**
 * Get authenticated user if logged in, returns null otherwise.
 * Use this for optional user tracking (e.g., download counting).
 */
export async function getAuthUser(event: H3Event): Promise<User | null> {
  const accessToken = getCookie(event, 'access_token')
  if (!accessToken) return null

  const payload = verifyAccessToken(accessToken)
  if (!payload) return null

  const user = await getUserById(payload.userId)
  return user || null
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

/**
 * Require authentication AND ToS acceptance.
 * Use this for actions that require legal agreement (e.g., uploading content).
 */
export async function requireAuthWithTos(event: H3Event): Promise<User> {
  const user = await requireAuth(event)

  if (!hasAcceptedCurrentTos(user.tos_accepted_version)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'TOS_NOT_ACCEPTED',
      message: 'You must accept the Terms of Service before performing this action',
    })
  }

  return user
}
