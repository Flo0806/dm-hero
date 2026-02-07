import type { DuplicateStatTemplatePayload, StatTemplateDbRow, StatTemplateGroupDbRow, StatTemplateFieldDbRow } from '~~/types/stat-template'

// Duplicate a template with all groups and fields
export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody<DuplicateStatTemplatePayload>(event)

  const template = db
    .prepare<unknown[], StatTemplateDbRow>(
      'SELECT * FROM stat_templates WHERE id = ? AND deleted_at IS NULL',
    )
    .get(id)

  if (!template) {
    throw createError({ statusCode: 404, message: 'Template not found' })
  }

  const maxOrder = db
    .prepare('SELECT MAX(sort_order) as max_order FROM stat_templates WHERE deleted_at IS NULL')
    .get() as { max_order: number | null }
  const sortOrder = (maxOrder.max_order ?? -1) + 1

  const newName = body.name || `${template.name} (Copy)`

  const transaction = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO stat_templates (name, system_key, description, sort_order)
         VALUES (?, NULL, ?, ?)`,
      )
      .run(newName, template.description, sortOrder)

    const newTemplateId = Number(result.lastInsertRowid)

    const groups = db
      .prepare<unknown[], StatTemplateGroupDbRow>(
        'SELECT * FROM stat_template_groups WHERE template_id = ? ORDER BY sort_order ASC',
      )
      .all(id)

    const insertGroup = db.prepare(
      `INSERT INTO stat_template_groups (template_id, name, group_type, sort_order)
       VALUES (?, ?, ?, ?)`,
    )
    const insertField = db.prepare(
      `INSERT INTO stat_template_fields (group_id, name, label, field_type, has_modifier, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )

    for (const group of groups) {
      const groupResult = insertGroup.run(newTemplateId, group.name, group.group_type, group.sort_order)
      const newGroupId = Number(groupResult.lastInsertRowid)

      const fields = db
        .prepare<unknown[], StatTemplateFieldDbRow>(
          'SELECT * FROM stat_template_fields WHERE group_id = ? ORDER BY sort_order ASC',
        )
        .all(group.id)

      for (const field of fields) {
        insertField.run(newGroupId, field.name, field.label, field.field_type, field.has_modifier, field.sort_order)
      }
    }

    return newTemplateId
  })

  const newTemplateId = transaction()

  return getStatTemplateById(newTemplateId)
})
