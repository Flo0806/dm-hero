import { extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { writeFile, mkdir } from 'node:fs/promises'
import { getUploadPath } from '../../utils/paths'

export default defineEventHandler(async (event) => {
  // Read multipart form data
  const files = await readMultipartFormData(event)

  if (!files || files.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No file uploaded',
    })
  }

  // Find the file field
  const file = files.find((f) => f.data && f.data.length > 0)

  if (!file || !file.data) {
    throw createError({
      statusCode: 400,
      message: 'No valid file data received',
    })
  }

  // Validate file type
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
  const ext = extname(file.filename || '').toLowerCase()

  if (!allowedExtensions.includes(ext)) {
    throw createError({
      statusCode: 400,
      message: `Invalid file type. Allowed types: ${allowedExtensions.join(', ')}`,
    })
  }

  // Validate file size (max 8MB)
  const maxSize = 8 * 1024 * 1024
  if (file.data.length > maxSize) {
    throw createError({
      statusCode: 413,
      message: 'File too large. Maximum size: 8MB',
    })
  }

  // Generate unique filename
  const uniqueName = `doc-${Date.now()}-${randomUUID()}${ext}`

  // Save to uploads directory
  const uploadsDir = getUploadPath()
  await mkdir(uploadsDir, { recursive: true })
  const filePath = join(uploadsDir, uniqueName)
  await writeFile(filePath, file.data)

  return {
    image_url: uniqueName,
  }
})
