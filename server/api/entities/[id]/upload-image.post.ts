import { extname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  console.log('=== Upload Image Request ===')
  const db = getDb()
  const entityId = getRouterParam(event, 'id')
  console.log('Entity ID:', entityId)

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
  console.log('Entity found:', entity)

  if (!entity) {
    throw createError({
      statusCode: 404,
      message: 'Entity not found',
    })
  }

  // Read multipart form data
  console.log('Reading multipart form data...')
  const files = await readMultipartFormData(event)
  console.log('Files received:', files?.length || 0)
  console.log(
    'Files details:',
    files?.map((f) => ({
      name: f.name,
      filename: f.filename,
      type: f.type,
      dataLength: f.data?.length || 0,
    })),
  )

  if (!files || files.length === 0) {
    console.error('No files received in request')
    throw createError({
      statusCode: 400,
      message: 'No file uploaded',
    })
  }

  // Find the file field (it could be named 'file' or something else)
  const file = files.find((f) => f.data && f.data.length > 0)
  console.log(
    'Selected file:',
    file
      ? {
          name: file.name,
          filename: file.filename,
          type: file.type,
          dataLength: file.data.length,
        }
      : 'none',
  )

  if (!file || !file.data) {
    console.error('No valid file data found')
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
  const uniqueName = `${Date.now()}-${randomUUID()}${ext}`

  // Save to storage
  const storage = useStorage('pictures')
  await storage.setItemRaw(uniqueName, file.data)

  // Get old image URL to delete it later
  const oldEntity = db.prepare('SELECT image_url FROM entities WHERE id = ?').get(entityId) as
    | { image_url: string | null }
    | undefined

  // Update entity with new image URL
  db.prepare('UPDATE entities SET image_url = ?, updated_at = ? WHERE id = ?').run(
    uniqueName,
    new Date().toISOString(),
    entityId,
  )

  // Delete old image if exists
  if (oldEntity?.image_url) {
    try {
      await storage.removeItem(oldEntity.image_url)
    } catch (error) {
      console.error('Failed to delete old image:', error)
      // Continue anyway, don't fail the upload
    }
  }

  return {
    success: true,
    imageUrl: uniqueName,
  }
})
