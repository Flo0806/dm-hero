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

    // Set appropriate content type for PDFs
    if (path.endsWith('.pdf')) {
      setResponseHeader(event, 'Content-Type', 'application/pdf')
      // Allow inline viewing in browser
      setResponseHeader(event, 'Content-Disposition', 'inline')
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
