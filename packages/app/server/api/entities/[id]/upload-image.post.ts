import { extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { writeFile, mkdir } from 'node:fs/promises'
import { getDb } from '../../../utils/db'
import { getUploadPath } from '../../../utils/paths'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const entityId = getRouterParam(event, 'id')

  if (!entityId) {
    throw createError({
      statusCode: 400,
      message: 'Entity ID is required',
    })
  }

  // Check if entity exists
  const entity = db
    .prepare('SELECT id FROM entities WHERE id = ? AND deleted_at IS NULL')
    .get(entityId)

  if (!entity) {
    throw createError({
      statusCode: 404,
      message: 'Entity not found',
    })
  }

  // Read multipart form data
  const files = await readMultipartFormData(event)

  if (!files || files.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No files uploaded',
    })
  }

  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
  const maxSize = 8 * 1024 * 1024 // 8MB
  const uploadedImages: Array<{ id: number; imageUrl: string; isPrimary: boolean }> = []

  const uploadsDir = getUploadPath()
  // Ensure uploads directory exists
  await mkdir(uploadsDir, { recursive: true })

  // Check if this is the first image - if so, make it primary
  const existingImages = db
    .prepare('SELECT COUNT(*) as count FROM entity_images WHERE entity_id = ?')
    .get(Number(entityId)) as { count: number }
  const shouldBePrimary = existingImages.count === 0

  // Get max display order
  const maxOrderResult = db
    .prepare('SELECT COALESCE(MAX(display_order), -1) as max_order FROM entity_images WHERE entity_id = ?')
    .get(Number(entityId)) as { max_order: number }
  let displayOrder = maxOrderResult.max_order + 1

  // Process all files
  for (const file of files) {
    if (!file.data || file.data.length === 0) continue

    // Validate file type
    const ext = extname(file.filename || '').toLowerCase()

    if (!allowedExtensions.includes(ext)) {
      console.warn(`Skipping file ${file.filename}: invalid extension`)
      continue
    }

    // Validate file size
    if (file.data.length > maxSize) {
      console.warn(`Skipping file ${file.filename}: too large`)
      continue
    }

    // Generate unique filename (UUID only, no timestamp prefix)
    const uniqueName = `${randomUUID()}${ext}`

    // Save to uploads directory
    const filePath = join(uploadsDir, uniqueName)
    await writeFile(filePath, file.data)

    // Insert into database
    const result = db
      .prepare(
        `
      INSERT INTO entity_images (entity_id, image_url, is_primary, display_order)
      VALUES (?, ?, ?, ?)
    `,
      )
      .run(
        Number(entityId),
        uniqueName,
        shouldBePrimary && uploadedImages.length === 0 ? 1 : 0,
        displayOrder++,
      )

    uploadedImages.push({
      id: result.lastInsertRowid as number,
      imageUrl: uniqueName,
      isPrimary: shouldBePrimary && uploadedImages.length === 0,
    })
  }

  // If no valid files were uploaded
  if (uploadedImages.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No valid files uploaded',
    })
  }

  // Always update entity's image_url with the newly uploaded image
  db.prepare('UPDATE entities SET image_url = ?, updated_at = ? WHERE id = ?').run(
    uploadedImages[0]?.imageUrl,
    new Date().toISOString(),
    entityId,
  )

  return {
    success: true,
    imageUrl: uploadedImages[0]?.imageUrl, // Backwards compatibility for single file upload
    images: uploadedImages,
  }
})
