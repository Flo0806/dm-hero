export default defineEventHandler(async (event) => {
  const storage = useStorage('pictures')
  const path = getRouterParam(event, 'path')

  if (!path) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Path is required',
    })
  }

  try {
    const image = await storage.getItemRaw(path)

    if (!image) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Image not found',
      })
    }

    return image
  }
  catch (error) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Image not found',
    })
  }
})
