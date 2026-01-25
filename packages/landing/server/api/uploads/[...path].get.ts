import { createReadStream, statSync, existsSync } from 'fs'
import { join } from 'path'
import { sendStream, setHeader, createError } from 'h3'

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.dmhero': 'application/octet-stream',
}

export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, 'path')

  if (!path) {
    throw createError({ statusCode: 400, message: 'Path is required' })
  }

  // Security: prevent directory traversal
  if (path.includes('..')) {
    throw createError({ statusCode: 400, message: 'Invalid path' })
  }

  const uploadsDir = join(process.cwd(), 'uploads')
  const filePath = join(uploadsDir, path)

  // Check file exists
  if (!existsSync(filePath)) {
    throw createError({ statusCode: 404, message: 'File not found' })
  }

  // Get file stats
  const stats = statSync(filePath)
  if (!stats.isFile()) {
    throw createError({ statusCode: 404, message: 'Not a file' })
  }

  // Determine MIME type
  const ext = '.' + path.split('.').pop()?.toLowerCase()
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream'

  // Set headers
  setHeader(event, 'Content-Type', mimeType)
  setHeader(event, 'Content-Length', stats.size)
  setHeader(event, 'Cache-Control', 'public, max-age=604800') // 1 week

  // Stream the file
  const stream = createReadStream(filePath)
  return sendStream(event, stream)
})
