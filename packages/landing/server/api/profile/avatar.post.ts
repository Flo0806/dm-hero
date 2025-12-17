import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { query } from '../../utils/db'
import { requireAuth } from '../../utils/requireAuth'
import { getUserById } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  let formData
  try {
    formData = await readMultipartFormData(event)
  } catch (err) {
    console.error('[Avatar] Failed to parse multipart form:', err)
    throw createError({
      statusCode: 400,
      message: 'Failed to parse form data',
    })
  }

  if (!formData) {
    throw createError({
      statusCode: 400,
      message: 'No form data provided',
    })
  }

  const avatarFile = formData.find((f) => f.name === 'avatar')
  if (!avatarFile || !avatarFile.data) {
    console.error('[Avatar] No avatar file found in form. Fields:', formData.map((f) => f.name))
    throw createError({
      statusCode: 400,
      message: 'No avatar file provided',
    })
  }

  // Validate file type - be more lenient with MIME type matching
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg']
  // Extract base MIME type (remove charset etc.)
  const mimeType = avatarFile.type?.split(';')[0]?.trim()?.toLowerCase()

  if (!mimeType || !allowedTypes.includes(mimeType)) {
    console.error('[Avatar] Invalid file type:', avatarFile.type, '-> extracted:', mimeType)
    throw createError({
      statusCode: 400,
      message: `Invalid file type: ${avatarFile.type}. Allowed: JPEG, PNG, GIF, WebP`,
    })
  }

  // Validate file size (max 2MB)
  const maxSize = 2 * 1024 * 1024
  if (avatarFile.data.length > maxSize) {
    throw createError({
      statusCode: 400,
      message: 'File too large. Maximum size is 2MB',
    })
  }

  // Create upload directory (uploads/ at project root, served via /api/uploads/...)
  const uploadDir = join(process.cwd(), 'uploads', 'avatars')
  await mkdir(uploadDir, { recursive: true })

  // Generate unique filename
  const ext = avatarFile.type.split('/')[1]
  const filename = `${user.id}-${Date.now()}.${ext}`
  const filepath = join(uploadDir, filename)

  // Save file
  await writeFile(filepath, avatarFile.data)

  // Update user avatar URL (served via /api/uploads/...)
  const avatarUrl = `/api/uploads/avatars/${filename}`
  await query('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, user.id])

  const updatedUser = await getUserById(user.id)

  return {
    avatarUrl,
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
