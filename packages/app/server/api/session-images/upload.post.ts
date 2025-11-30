import { extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { writeFile, mkdir } from 'node:fs/promises'
import { getDb } from '../../utils/db'
import { getUploadPath } from '../../utils/paths'

export default defineEventHandler(async (event) => {
  const db = getDb()

  // Read multipart form data
  const formData = await readMultipartFormData(event)

  if (!formData || formData.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No files uploaded',
    })
  }

  // Extract sessionId from form data
  const sessionIdField = formData.find((f) => f.name === 'sessionId')

  if (!sessionIdField || !sessionIdField.data) {
    throw createError({
      statusCode: 400,
      message: 'Session ID is required',
    })
  }

  const sessionId = Number.parseInt(sessionIdField.data.toString('utf-8'))

  // Check if session exists
  const session = db
    .prepare('SELECT id FROM sessions WHERE id = ? AND deleted_at IS NULL')
    .get(sessionId)

  if (!session) {
    throw createError({
      statusCode: 404,
      message: 'Session not found',
    })
  }

  // Process all image files
  const imageFiles = formData.filter((f) => f.name === 'images' && f.data && f.data.length > 0)

  if (imageFiles.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No valid image files received',
    })
  }

  const uploadedImages: Array<{ id: number; imageUrl: string }> = []
  const uploadsDir = getUploadPath()
  // Ensure uploads directory exists
  await mkdir(uploadsDir, { recursive: true })

  // Get current max display_order for this session
  const maxDisplayOrder = db
    .prepare(
      `
    SELECT COALESCE(MAX(display_order), -1) as max_order
    FROM session_images
    WHERE session_id = ?
  `,
    )
    .get(sessionId) as { max_order: number }

  let displayOrder = maxDisplayOrder.max_order + 1

  for (const file of imageFiles) {
    // Validate file type
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    const ext = extname(file.filename || '').toLowerCase()

    if (!allowedExtensions.includes(ext)) {
      console.warn(`Skipping invalid file type: ${file.filename}`)
      continue
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.data.length > maxSize) {
      console.warn(`Skipping file too large: ${file.filename}`)
      continue
    }

    // Generate unique filename
    const uniqueName = `${Date.now()}-${randomUUID()}${ext}`

    // Save to uploads directory
    const filePath = join(uploadsDir, uniqueName)
    await writeFile(filePath, file.data)

    // Check if this is the first image for this session
    const imageCount = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM session_images
      WHERE session_id = ?
    `,
      )
      .get(sessionId) as { count: number }

    const isPrimary = imageCount.count === 0 ? 1 : 0

    // Insert into session_images table
    const result = db
      .prepare(
        `
      INSERT INTO session_images (session_id, image_url, is_primary, display_order, created_at)
      VALUES (?, ?, ?, ?, ?)
    `,
      )
      .run(sessionId, uniqueName, isPrimary, displayOrder, new Date().toISOString())

    uploadedImages.push({
      id: Number(result.lastInsertRowid),
      imageUrl: uniqueName,
    })

    displayOrder++
  }

  return {
    success: true,
    uploadedImages,
  }
})
