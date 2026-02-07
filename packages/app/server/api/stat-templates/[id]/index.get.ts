// Get single template with nested groups and fields
export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, 'id'))
  const template = getStatTemplateById(id)

  if (!template) {
    throw createError({ statusCode: 404, message: 'Template not found' })
  }

  return template
})
