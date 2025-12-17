import { query } from '../../utils/db'
import { requireAuth } from '../../utils/requireAuth'
import { getUserById } from '../../utils/auth'

interface UpdateProfileBody {
  displayName: string
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody<UpdateProfileBody>(event)

  if (!body.displayName || body.displayName.length < 2 || body.displayName.length > 100) {
    throw createError({
      statusCode: 400,
      message: 'Display name must be between 2 and 100 characters',
    })
  }

  await query('UPDATE users SET display_name = ? WHERE id = ?', [body.displayName, user.id])

  const updatedUser = await getUserById(user.id)

  return {
    user: updatedUser
      ? {
          id: updatedUser.id,
          email: updatedUser.email,
          displayName: updatedUser.display_name,
          avatarUrl: updatedUser.avatar_url,
          role: updatedUser.role,
          emailVerified: updatedUser.email_verified,
        }
      : null,
  }
})
