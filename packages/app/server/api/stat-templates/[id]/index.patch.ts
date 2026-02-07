import type { UpdateStatTemplatePayload } from '~~/types/stat-template'

// Update template name/description
export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody<UpdateStatTemplatePayload>(event)

  // Check template exists
  const exists = db
    .prepare('SELECT id FROM stat_templates WHERE id = ? AND deleted_at IS NULL')
    .get(id)

  if (!exists) {
    throw createError({ statusCode: 404, message: 'Template not found' })
  }

  const updates: string[] = []
  const values: unknown[] = []

  if (body.name !== undefined) {
    updates.push('name = ?')
    values.push(body.name)
  }
  if (body.description !== undefined) {
    updates.push('description = ?')
    values.push(body.description)
  }

  if (updates.length === 0) {
    throw createError({ statusCode: 400, message: 'No fields to update' })
  }

  updates.push("updated_at = datetime('now')")
  values.push(id)

  db.prepare(`UPDATE stat_templates SET ${updates.join(', ')} WHERE id = ?`).run(...values)

  return { success: true }
})
