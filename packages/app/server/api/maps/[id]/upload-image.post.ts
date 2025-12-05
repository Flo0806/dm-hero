import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { getDb } from '~~/server/utils/db'
import { getUploadPath } from '~~/server/utils/paths'
import type { CampaignMap } from '~~/types/map'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Map ID is required',
    })
  }

  // Check if map exists
  const existing = db
    .prepare('SELECT id FROM campaign_maps WHERE id = ? AND deleted_at IS NULL')
    .get(Number(id))

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Map not found',
    })
  }

  const formData = await readMultipartFormData(event)
  if (!formData) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No file uploaded',
    })
  }

  const file = formData.find((f) => f.name === 'image')
  if (!file || !file.data) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No image file found',
    })
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!file.type || !allowedTypes.includes(file.type)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid file type. Allowed: JPG, PNG, GIF, WebP',
    })
  }

  // Validate file size (max 20MB for maps - larger than normal images)
  const maxSize = 20 * 1024 * 1024
  if (file.data.length > maxSize) {
    throw createError({
      statusCode: 400,
      statusMessage: 'File too large. Maximum size: 20MB',
    })
  }

  // Generate filename
  const ext = file.type.split('/')[1] || 'jpg'
  const filename = `map_${id}_${Date.now()}.${ext}`

  // Ensure maps directory exists
  const uploadBase = getUploadPath()
  const mapsDir = join(uploadBase, 'maps')
  await mkdir(mapsDir, { recursive: true })

  // Save file
  const filePath = join(mapsDir, filename)
  await writeFile(filePath, new Uint8Array(file.data))

  // Update map with image URL
  const imageUrl = `maps/${filename}`
  db.prepare(
    'UPDATE campaign_maps SET image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
  ).run(imageUrl, Number(id))

  const map = db
    .prepare('SELECT * FROM campaign_maps WHERE id = ?')
    .get(Number(id)) as CampaignMap

  return map
})
