import { createReadStream, existsSync } from 'fs'
import { stat } from 'fs/promises'
import { join } from 'path'
import { getUploadPath } from '../../utils/paths'

/**
 * Serve document files (PDFs) from storage
 * Route: /documents/[filename]
 * Example: /documents/uuid.pdf
 *
 * Uses getUploadPath() for Electron compatibility (same as /uploads/ route)
 */
export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, 'path')

  if (!path) {
    throw createError({
      statusCode: 400,
      message: 'File path is required',
    })
  }

  // Documents (PDFs) storage locations:
  // - New/correct: uploads/uuid.pdf (DB stores: uuid.pdf)
  // - Old broken import: uploads/documents/uuid.pdf (DB stores: documents/uuid.pdf)
  //
  // This route handles both by checking multiple locations.
  // Self-heals: old data works, re-export/import will fix the DB entry.
  const uploadPath = getUploadPath()

  // Try different possible file locations
  let filePath: string | null = null

  if (path.startsWith('documents/')) {
    // Old format: DB has "documents/uuid.pdf", file is at uploads/documents/uuid.pdf
    const oldPath = join(uploadPath, path)
    const newPath = join(uploadPath, path.substring('documents/'.length))

    if (existsSync(oldPath)) {
      filePath = oldPath
    }
    else if (existsSync(newPath)) {
      filePath = newPath
    }
  }
  else {
    // New format: DB has "uuid.pdf", file is at uploads/uuid.pdf
    const directPath = join(uploadPath, path)
    if (existsSync(directPath)) {
      filePath = directPath
    }
  }

  if (!filePath) {
    console.error('Document not found. Tried paths for:', path)
    throw createError({
      statusCode: 404,
      message: 'File not found',
    })
  }

  try {
    // Check if download is requested via query parameter
    const query = getQuery(event)
    const shouldDownload = query.download === '1'

    // Set appropriate content type for PDFs
    if (path.endsWith('.pdf')) {
      if (shouldDownload) {
        // Force download: Use octet-stream for better browser compatibility (especially Firefox)
        setResponseHeader(event, 'Content-Type', 'application/octet-stream')
        setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate')
        setResponseHeader(event, 'Pragma', 'no-cache')
        setResponseHeader(event, 'Expires', '0')
        // Extract original filename from path (without UUID)
        const filename = path.split('/').pop() || 'document.pdf'
        setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)
      }
      else {
        // Allow inline viewing in browser (preview mode)
        setResponseHeader(event, 'Content-Type', 'application/pdf')
        setResponseHeader(event, 'Content-Disposition', 'inline')
      }
    }

    // Get file size for Content-Length
    const stats = await stat(filePath)
    setResponseHeader(event, 'Content-Length', stats.size)

    // Return file stream
    return sendStream(event, createReadStream(filePath))
  }
  catch (error) {
    console.error('Document fetch error:', error)
    throw createError({
      statusCode: 404,
      message: 'File not found',
    })
  }
})
