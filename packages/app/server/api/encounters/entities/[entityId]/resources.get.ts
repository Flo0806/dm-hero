import { getDb } from '../../../../utils/db'

interface StatsRow {
  template_id: number
  values_json: string
}

interface FieldRow {
  name: string
  label: string
}

export default defineEventHandler((event) => {
  const db = getDb()
  const entityId = getRouterParam(event, 'entityId')

  if (!entityId) {
    throw createError({ statusCode: 400, message: 'Entity ID is required' })
  }

  const stats = db.prepare(
    'SELECT template_id, values_json FROM entity_stats WHERE entity_id = ?',
  ).get(entityId) as StatsRow | undefined

  if (!stats) {
    return { resources: [] }
  }

  const fields = db.prepare<unknown[], FieldRow>(`
    SELECT f.name, f.label
    FROM stat_template_fields f
    JOIN stat_template_groups g ON g.id = f.group_id
    WHERE g.template_id = ? AND f.field_type = 'resource'
  `).all(stats.template_id)

  const resources: { name: string, label: string, current: number, max: number }[] = []

  try {
    const values = JSON.parse(stats.values_json || '{}')
    for (const field of fields) {
      const val = values[field.name]
      if (val && typeof val === 'object' && 'current' in val && 'max' in val) {
        resources.push({
          name: field.name,
          label: field.label,
          current: Number(val.current) || 0,
          max: Number(val.max) || 0,
        })
      }
    }
  }
  catch {
    // ignore
  }

  return { resources }
})
