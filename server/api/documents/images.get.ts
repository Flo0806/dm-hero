export default defineEventHandler(async () => {
  try {
    const storage = useStorage('pictures')
    const keys = await storage.getKeys()

    // Filter for document images (prefixed with 'doc-') and return just the filenames
    const documentImages = keys
      .filter((key) => key.startsWith('doc-'))
      .sort((a, b) => b.localeCompare(a)) // Sort newest first (by timestamp in filename)

    return documentImages
  } catch (error) {
    console.error('Failed to list images:', error)
    return []
  }
})
