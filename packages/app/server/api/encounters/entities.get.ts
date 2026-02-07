import { getDb } from '../../utils/db'

interface EntityRow {
  id: number
  name: string
  description: string | null
  image_url: string | null
  type_name: string
  values_json: string | null
  template_id: number | null
}

interface ResourceField {
  name: string
  label: string
  current: number
  max: number
}

interface ResourceFieldRow {
  name: string
  label: string
}

export default defineEventHandler((event) => {
  const db = getDb()
  const query = getQuery(event)
  const campaignId = query.campaignId as string
  const type = query.type as string | undefined
  const search = query.search as string | undefined

  if (!campaignId) {
    throw createError({ statusCode: 400, message: 'Campaign ID is required' })
  }

  const allowedTypes = ['NPC', 'Player']
  const filterType = type && allowedTypes.includes(type) ? type : null

  let sql = `
    SELECT e.id, e.name, e.description, ei.image_url, et.name as type_name,
           es.values_json, es.template_id
    FROM entities e
    JOIN entity_types et ON et.id = e.type_id
    JOIN entity_stats es ON es.entity_id = e.id
    LEFT JOIN (
      SELECT entity_id, image_url
      FROM entity_images
      WHERE is_primary = 1
    ) ei ON ei.entity_id = e.id
    WHERE e.campaign_id = ?
      AND e.deleted_at IS NULL
      AND et.name IN ('NPC', 'Player')
  `
  const params: unknown[] = [campaignId]

  if (filterType) {
    sql += ' AND et.name = ?'
    params.push(filterType)
  }

  if (search?.trim()) {
    sql += ' AND e.name LIKE ?'
    params.push(`%${search.trim()}%`)
  }

  sql += ' ORDER BY e.name ASC'

  const entities = db.prepare<unknown[], EntityRow>(sql).all(...params)

  // Get resource fields per template (cached)
  const templateResourcesCache = new Map<number, ResourceFieldRow[]>()

  return entities.map((e) => {
    const resources: ResourceField[] = []

    if (e.template_id && e.values_json) {
      // Get resource field definitions from template
      if (!templateResourcesCache.has(e.template_id)) {
        const fields = db.prepare<unknown[], ResourceFieldRow>(`
          SELECT f.name, f.label
          FROM stat_template_fields f
          JOIN stat_template_groups g ON g.id = f.group_id
          WHERE g.template_id = ? AND f.field_type = 'resource'
        `).all(e.template_id)
        templateResourcesCache.set(e.template_id, fields)
      }

      const fieldDefs = templateResourcesCache.get(e.template_id)!
      try {
        const values = JSON.parse(e.values_json)
        for (const field of fieldDefs) {
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
        // ignore parse errors
      }
    }

    // Auto-detect HP field by checking name, label, and resolved i18n label
    let autoHpField: string | null = null
    const hpNames = ['hp', 'tp', 'hit points', 'trefferpunkte', 'health', 'leben']
    for (const r of resources) {
      const nameLower = r.name.toLowerCase()
      const labelLower = r.label.toLowerCase()
      // Check raw name and label
      if (hpNames.some(hp => nameLower === hp || nameLower.includes(hp) || labelLower === hp || labelLower.includes(hp))) {
        autoHpField = r.name
        break
      }
      // Check i18n key labels (e.g. "statPresets.dnd5e.hp" → last segment "hp")
      if (r.label.startsWith('statPresets.')) {
        const lastSegment = r.label.split('.').pop()?.toLowerCase() ?? ''
        if (hpNames.includes(lastSegment)) {
          autoHpField = r.name
          break
        }
      }
    }

    return {
      id: e.id,
      name: e.name,
      image_url: e.image_url,
      type_name: e.type_name,
      resources,
      autoHpField,
    }
  })
})
