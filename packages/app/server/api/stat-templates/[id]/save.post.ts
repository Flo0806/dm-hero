import type { SaveStatTemplatePayload } from '~~/types/stat-template'

// Save entire template: name, description, and groups+fields in one call.
// Replaces all existing groups/fields in one transaction.
// Also cleans up orphaned keys in linked entity_stats.values_json.
export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody<SaveStatTemplatePayload>(event)

  const exists = db
    .prepare('SELECT id FROM stat_templates WHERE id = ? AND deleted_at IS NULL')
    .get(id)

  if (!exists) {
    throw createError({ statusCode: 404, message: 'Template not found' })
  }

  if (!body.groups || !Array.isArray(body.groups)) {
    throw createError({ statusCode: 400, message: 'Groups array is required' })
  }

  // Collect all valid field names from the new structure
  const validFieldNames = new Set<string>()
  for (const group of body.groups) {
    for (const field of group.fields) {
      validFieldNames.add(field.name)
    }
  }

  const transaction = db.transaction(() => {
    // Update name/description
    db.prepare(
      'UPDATE stat_templates SET name = ?, description = ?, updated_at = datetime(\'now\') WHERE id = ?',
    ).run(body.name || '', body.description || null, id)

    // Delete all existing groups (CASCADE deletes fields)
    db.prepare('DELETE FROM stat_template_groups WHERE template_id = ?').run(id)

    const insertGroup = db.prepare(
      `INSERT INTO stat_template_groups (template_id, name, group_type, sort_order)
       VALUES (?, ?, ?, ?)`,
    )
    const insertField = db.prepare(
      `INSERT INTO stat_template_fields (group_id, name, label, field_type, has_modifier, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )

    for (let gi = 0; gi < body.groups.length; gi++) {
      const group = body.groups[gi]!
      const groupResult = insertGroup.run(id, group.name, group.group_type, gi)
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

    // Clean up orphaned keys in entity_stats for entities using this template
    const linkedStats = db
      .prepare<unknown[], { id: number, values_json: string }>(
        'SELECT id, values_json FROM entity_stats WHERE template_id = ?',
      )
      .all(id)

    if (linkedStats.length > 0) {
      const updateValues = db.prepare(
        "UPDATE entity_stats SET values_json = ?, updated_at = datetime('now') WHERE id = ?",
      )

      for (const stat of linkedStats) {
        const values = JSON.parse(stat.values_json || '{}') as Record<string, unknown>
        const cleaned: Record<string, unknown> = {}

        for (const [key, val] of Object.entries(values)) {
          if (validFieldNames.has(key)) {
            cleaned[key] = val
          }
        }

        updateValues.run(JSON.stringify(cleaned), stat.id)
      }
    }
  })

  transaction()

  return getStatTemplateById(id)
})
