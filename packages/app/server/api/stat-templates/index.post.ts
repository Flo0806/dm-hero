import { getPresetByKey } from '../../data/stat-presets'
import type { CreateStatTemplatePayload } from '~~/types/stat-template'

// Create a new stat template.
// fromPreset: server reads preset, stores i18n keys (labels follow language).
// groups: client sends pre-built structure (plain text labels).
export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody<CreateStatTemplatePayload>(event)

  if (!body.name) {
    throw createError({ statusCode: 400, message: 'Name is required' })
  }

  const maxOrder = db
    .prepare('SELECT MAX(sort_order) as max_order FROM stat_templates WHERE deleted_at IS NULL')
    .get() as { max_order: number | null }
  const sortOrder = (maxOrder.max_order ?? -1) + 1

  const systemKey = body.fromPreset || body.system_key || null

  const result = db
    .prepare(
      `INSERT INTO stat_templates (name, system_key, description, sort_order)
       VALUES (?, ?, ?, ?)`,
    )
    .run(body.name, systemKey, body.description || null, sortOrder)

  const templateId = Number(result.lastInsertRowid)

  // Determine groups to insert: from preset (i18n keys) or from body (plain text)
  const preset = body.fromPreset ? getPresetByKey(body.fromPreset) : null
  const groups = preset
    ? preset.groups.map(g => ({
        name: g.name,
        group_type: g.group_type,
        fields: g.fields.map(f => ({
          name: f.name,
          label: f.label,
          field_type: f.field_type,
          has_modifier: f.has_modifier || false,
        })),
      }))
    : body.groups

  if (groups && groups.length > 0) {
    const insertGroup = db.prepare(
      `INSERT INTO stat_template_groups (template_id, name, group_type, sort_order)
       VALUES (?, ?, ?, ?)`,
    )
    const insertField = db.prepare(
      `INSERT INTO stat_template_fields (group_id, name, label, field_type, has_modifier, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )

    const transaction = db.transaction(() => {
      for (let gi = 0; gi < groups.length; gi++) {
        const group = groups[gi]!
        const groupResult = insertGroup.run(templateId, group.name, group.group_type, gi)
        const groupId = Number(groupResult.lastInsertRowid)

        for (let fi = 0; fi < group.fields.length; fi++) {
          const field = group.fields[fi]!
          insertField.run(
            groupId,
            field.name,
            field.label,
            field.field_type,
            field.has_modifier ? 1 : 0,
            fi,
          )
        }
      }
    })

    transaction()
  }

  return getStatTemplateById(templateId)
})
