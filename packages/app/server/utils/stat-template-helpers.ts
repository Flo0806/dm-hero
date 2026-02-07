import type { StatTemplate, StatTemplateDbRow, StatTemplateGroupDbRow, StatTemplateFieldDbRow } from '~~/types/stat-template'

// Shared helper to load a single template with nested groups + fields.
// Used by multiple API routes to avoid internal $fetch() calls.
export function getStatTemplateById(id: number): StatTemplate | null {
  const db = getDb()

  const template = db
    .prepare<unknown[], StatTemplateDbRow>(
      `SELECT id, name, system_key, description, sort_order, is_imported, created_at, updated_at
       FROM stat_templates WHERE id = ? AND deleted_at IS NULL`,
    )
    .get(id)

  if (!template) return null

  const groups = db
    .prepare<unknown[], StatTemplateGroupDbRow>(
      `SELECT id, template_id, name, group_type, sort_order, created_at
       FROM stat_template_groups WHERE template_id = ? ORDER BY sort_order ASC`,
    )
    .all(id)

  const groupIds = groups.map(g => g.id)
  let fields: StatTemplateFieldDbRow[] = []

  if (groupIds.length > 0) {
    const placeholders = groupIds.map(() => '?').join(',')
    fields = db
      .prepare<unknown[], StatTemplateFieldDbRow>(
        `SELECT id, group_id, name, label, field_type, has_modifier, sort_order, created_at
         FROM stat_template_fields WHERE group_id IN (${placeholders}) ORDER BY sort_order ASC`,
      )
      .all(...groupIds)
  }

  const fieldsByGroup = new Map<number, StatTemplateFieldDbRow[]>()
  for (const field of fields) {
    const list = fieldsByGroup.get(field.group_id) || []
    list.push(field)
    fieldsByGroup.set(field.group_id, list)
  }

  return {
    ...template,
    system_key: template.system_key as StatTemplate['system_key'],
    is_imported: Boolean(template.is_imported),
    groups: groups.map(g => ({
      ...g,
      group_type: g.group_type as StatTemplate['groups'][number]['group_type'],
      fields: (fieldsByGroup.get(g.id) || []).map(f => ({
        ...f,
        field_type: f.field_type as StatTemplate['groups'][number]['fields'][number]['field_type'],
        has_modifier: Boolean(f.has_modifier),
      })),
    })),
  }
}
