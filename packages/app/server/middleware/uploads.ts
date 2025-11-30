import { join } from 'node:path'
import { readFile, stat } from 'node:fs/promises'
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

    // Read and serve the file
    const fileBuffer = await readFile(fullPath)

    // Set content type based on extension
    const ext = filename.split('.').pop()?.toLowerCase()
    const contentTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      pdf: 'application/pdf',
    }

    const contentType = contentTypes[ext || ''] || 'application/octet-stream'

    setHeader(event, 'Content-Type', contentType)
    setHeader(event, 'Content-Length', fileBuffer.length)
    setHeader(event, 'Cache-Control', 'public, max-age=31536000') // 1 year cache

    return fileBuffer
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return // Let it fall through to 404
    }
    throw error
  }
})
