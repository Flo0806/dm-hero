import type { StatTemplateDbRow, StatTemplateGroupDbRow, StatTemplateFieldDbRow, StatTemplate } from '~~/types/stat-template'

// List all templates with nested groups and fields
export default defineEventHandler(() => {
  const db = getDb()

  const templates = db
    .prepare<unknown[], StatTemplateDbRow>(
      `SELECT id, name, system_key, description, sort_order, is_imported, created_at, updated_at
       FROM stat_templates WHERE deleted_at IS NULL ORDER BY sort_order ASC, name ASC`,
    )
    .all()

  if (templates.length === 0) return []

  const templateIds = templates.map(t => t.id)
  const placeholders = templateIds.map(() => '?').join(',')

  const groups = db
    .prepare<unknown[], StatTemplateGroupDbRow>(
      `SELECT id, template_id, name, group_type, sort_order, created_at
       FROM stat_template_groups WHERE template_id IN (${placeholders})
       ORDER BY sort_order ASC`,
    )
    .all(...templateIds)

  const groupIds = groups.map(g => g.id)
  let fields: StatTemplateFieldDbRow[] = []

  if (groupIds.length > 0) {
    const groupPlaceholders = groupIds.map(() => '?').join(',')
    fields = db
      .prepare<unknown[], StatTemplateFieldDbRow>(
        `SELECT id, group_id, name, label, field_type, has_modifier, sort_order, created_at
         FROM stat_template_fields WHERE group_id IN (${groupPlaceholders})
         ORDER BY sort_order ASC`,
      )
      .all(...groupIds)
  }

  const fieldsByGroup = new Map<number, StatTemplateFieldDbRow[]>()
  for (const field of fields) {
    const list = fieldsByGroup.get(field.group_id) || []
    list.push(field)
    fieldsByGroup.set(field.group_id, list)
  }

  const groupsByTemplate = new Map<number, StatTemplateGroupDbRow[]>()
  for (const group of groups) {
    const list = groupsByTemplate.get(group.template_id) || []
    list.push(group)
    groupsByTemplate.set(group.template_id, list)
  }

  return templates.map<StatTemplate>(t => ({
    ...t,
    system_key: t.system_key as StatTemplate['system_key'],
    is_imported: Boolean(t.is_imported),
    groups: (groupsByTemplate.get(t.id) || []).map(g => ({
      ...g,
      group_type: g.group_type as StatTemplate['groups'][number]['group_type'],
      fields: (fieldsByGroup.get(g.id) || []).map(f => ({
        ...f,
        field_type: f.field_type as StatTemplate['groups'][number]['fields'][number]['field_type'],
        has_modifier: Boolean(f.has_modifier),
      })),
    })),
  }))
})
