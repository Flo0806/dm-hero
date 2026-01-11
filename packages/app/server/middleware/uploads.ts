import { join } from 'node:path'
import { stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { getUploadPath } from '../utils/paths'

/**
 * Middleware to serve uploaded files from the uploads directory
 *
 * Since uploads are stored outside of public/, this middleware
 * handles all /uploads/* requests in both Web and Electron modes
 */
export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)

  // Only handle /uploads/* requests
  if (!url.pathname.startsWith('/uploads/')) {
    return
  }

  // Extract filename from path
  const filename = url.pathname.replace('/uploads/', '')

  if (!filename) {
    return
  }

  // Prevent directory traversal attacks
  if (filename.includes('..') || filename.includes('//')) {
    throw createError({
      statusCode: 400,
      message: 'Invalid file path',
    })
  }

  const uploadsDir = getUploadPath()
  const fullPath = join(uploadsDir, filename)

  // Ensure the resolved path is still within uploads directory
  if (!fullPath.startsWith(uploadsDir)) {
    throw createError({
      statusCode: 403,
      message: 'Access denied',
    })
  }

  try {
    // Check if file exists
    const stats = await stat(fullPath)
    if (!stats.isFile()) {
      return // Let it fall through to 404
    }

    // Set content type based on extension
    const ext = filename.split('.').pop()?.toLowerCase()
    const contentTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      bmp: 'image/bmp',
      pdf: 'application/pdf',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
    }

    const contentType = contentTypes[ext || ''] || 'application/octet-stream'

    setHeader(event, 'Content-Type', contentType)
    setHeader(event, 'Content-Length', stats.size)
    setHeader(event, 'Cache-Control', 'public, max-age=31536000') // 1 year cache

    // Stream file instead of loading into memory (crucial for large maps 25MB+)
    return sendStream(event, createReadStream(fullPath))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return // Let it fall through to 404
    }
    throw error
  }
})
