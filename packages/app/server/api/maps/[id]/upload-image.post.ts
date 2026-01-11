import { mkdir, writeFile, rm } from 'fs/promises'
import { createWriteStream } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { getDb } from '~~/server/utils/db'
import { getUploadPath } from '~~/server/utils/paths'
import type { CampaignMap } from '~~/types/map'

// =============================================================================
// STREAMING MULTIPART PARSER FOR LARGE MAP IMAGES
// =============================================================================
// Large battlemaps can be 16-50MB. The default h3 readMultipartFormData()
// has array size limits that fail with large files ("Invalid array length").
//
// This streaming implementation:
// 1. Streams the raw HTTP body directly to a temp file
// 2. Parses the multipart boundaries to extract the image
// 3. Validates and saves the image file
// =============================================================================

// Stream request body to temp file
async function streamBodyToFile(event: Parameters<typeof defineEventHandler>[0] extends (e: infer E) => unknown ? E : never, filePath: string): Promise<void> {
  const stream = getRequestWebStream(event)
  if (!stream) {
    throw new Error('No request stream available')
  }

  const reader = stream.getReader()
  const writeStream = createWriteStream(filePath)

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      writeStream.write(value)
    }
  } finally {
    writeStream.end()
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve)
      writeStream.on('error', reject)
    })
  }
}

// Parse multipart boundary from content-type header
function getMultipartBoundary(contentType: string): string | null {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)
  return match ? (match[1] || match[2]) : null
}

// Extract image from multipart data
async function extractImageFromMultipart(rawFilePath: string, boundary: string): Promise<{ data: Buffer; contentType: string; filename: string } | null> {
  const { readFile } = await import('fs/promises')

  const raw = await readFile(rawFilePath)
  const boundaryMarker = Buffer.from(`--${boundary}`)

  // Find parts by splitting on boundary
  let start = 0
  while (start < raw.length) {
    const boundaryIndex = raw.indexOf(boundaryMarker, start)
    if (boundaryIndex === -1) break

    const nextBoundary = raw.indexOf(boundaryMarker, boundaryIndex + boundaryMarker.length)
    if (nextBoundary === -1) break

    const partData = raw.subarray(boundaryIndex + boundaryMarker.length, nextBoundary)

    // Find headers end (double CRLF)
    const headersEnd = partData.indexOf(Buffer.from('\r\n\r\n'))
    if (headersEnd === -1) {
      start = boundaryIndex + boundaryMarker.length
      continue
    }

    const headersStr = partData.subarray(0, headersEnd).toString('utf-8')

    // Check if this is the image field
    if (headersStr.includes('name="image"')) {
      // Extract content type
      const contentTypeMatch = headersStr.match(/Content-Type:\s*([^\r\n]+)/i)
      const contentType = contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream'

      // Extract filename
      const filenameMatch = headersStr.match(/filename="([^"]+)"/)
      const filename = filenameMatch ? filenameMatch[1] : 'image.jpg'

      // Extract body (skip headers + CRLF, trim trailing CRLF before boundary)
      let body = partData.subarray(headersEnd + 4)
      // Trim trailing \r\n before boundary
      if (body.length >= 2 && body[body.length - 2] === 0x0d && body[body.length - 1] === 0x0a) {
        body = body.subarray(0, -2)
      }

      return { data: body, contentType, filename }
    }

    start = nextBoundary
  }

  return null
}

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

  // Get content type and boundary
  const contentType = getHeader(event, 'content-type') || ''
  const boundary = getMultipartBoundary(contentType)

  if (!boundary) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid multipart request',
    })
  }

  // Stream body to temp file
  const tempDir = join(tmpdir(), `dm-hero-map-${randomUUID()}`)
  const tempFile = join(tempDir, 'upload.raw')
  await mkdir(tempDir, { recursive: true })

  try {
    await streamBodyToFile(event, tempFile)

    // Extract image from multipart
    const image = await extractImageFromMultipart(tempFile, boundary)

    if (!image) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No image file found',
      })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp']
    if (!allowedTypes.includes(image.contentType)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'INVALID_FILE_TYPE',
      })
    }

    // Validate file size (max 50MB for maps - battlemaps can be very large)
    const maxSize = 50 * 1024 * 1024
    if (image.data.length > maxSize) {
      throw createError({
        statusCode: 400,
        statusMessage: 'FILE_TOO_LARGE',
      })
    }

    // Generate filename
    const ext = image.contentType.split('/')[1] || 'jpg'
    const filename = `map_${id}_${Date.now()}.${ext}`

    // Ensure maps directory exists
    const uploadBase = getUploadPath()
    const mapsDir = join(uploadBase, 'maps')
    await mkdir(mapsDir, { recursive: true })

    // Save file
    const filePath = join(mapsDir, filename)
    await writeFile(filePath, image.data)

    // Update map with image URL
    const imageUrl = `maps/${filename}`
    db.prepare(
      'UPDATE campaign_maps SET image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ).run(imageUrl, Number(id))

    const map = db
      .prepare('SELECT * FROM campaign_maps WHERE id = ?')
      .get(Number(id)) as CampaignMap

    return map
  } finally {
    // Cleanup temp files
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
})
