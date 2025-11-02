import { extname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { getDb } from '../../utils/db'

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

  // Extract entityId and entityType from form data
  const entityIdField = formData.find(f => f.name === 'entityId')
  const entityTypeField = formData.find(f => f.name === 'entityType')

  if (!entityIdField || !entityIdField.data) {
    throw createError({
      statusCode: 400,
      message: 'Entity ID is required',
    })
  }

  const entityId = Number.parseInt(entityIdField.data.toString('utf-8'))

  // Check if entity exists
  const entity = db.prepare('SELECT id FROM entities WHERE id = ? AND deleted_at IS NULL').get(entityId)

  if (!entity) {
    throw createError({
      statusCode: 404,
      message: 'Entity not found',
    })
  }

  // Process all image files
  const imageFiles = formData.filter(f => f.name === 'images' && f.data && f.data.length > 0)

  if (imageFiles.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No valid image files received',
    })
  }

  const uploadedImages: Array<{ id: number, imageUrl: string }> = []
  const storage = useStorage('pictures')

  // Get current max display_order for this entity
  const maxDisplayOrder = db.prepare(`
    SELECT COALESCE(MAX(display_order), -1) as max_order
    FROM entity_images
    WHERE entity_id = ?
  `).get(entityId) as { max_order: number }

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

    // Save to storage
    await storage.setItemRaw(uniqueName, file.data)

    // Check if this is the first image for this entity
    const imageCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM entity_images
      WHERE entity_id = ?
    `).get(entityId) as { count: number }

    const isPrimary = imageCount.count === 0 ? 1 : 0

    // Insert into entity_images table
    const result = db.prepare(`
      INSERT INTO entity_images (entity_id, image_url, is_primary, display_order, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(entityId, uniqueName, isPrimary, displayOrder, new Date().toISOString())

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
