/**
 * Serve document files (PDFs) from storage
 * Route: /documents/[filename]
 * Example: /documents/uuid.pdf
 */
export default defineEventHandler(async (event) => {
  const storage = useStorage('pictures') // Same storage as images
  const path = getRouterParam(event, 'path')

  if (!path) {
    throw createError({
      statusCode: 400,
      message: 'File path is required',
    })
  }

  try {
    const file = await storage.getItemRaw(path)

    if (!file) {
      throw createError({
        statusCode: 404,
        message: 'File not found',
      })
    }

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
      } else {
        // Allow inline viewing in browser (preview mode)
        setResponseHeader(event, 'Content-Type', 'application/pdf')
        setResponseHeader(event, 'Content-Disposition', 'inline')
      }
    }

    return file
  } catch (error) {
    console.error('Document fetch error:', error)
    throw createError({
      statusCode: 404,
      message: 'File not found',
    })
  }
})
