import { getDb } from '../../../../utils/db'

interface EntityRow {
  id: number
  name: string
  type_name: string
  image_url: string | null
}

interface StatRow {
  values_json: string
}

interface FieldRow {
  name: string
  field_type: string
}

export default defineEventHandler(async (event) => {
  const db = getDb()
  const encounterId = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!encounterId) {
    throw createError({ statusCode: 400, message: 'Encounter ID is required' })
  }

  const { entityIds } = body as { entityIds: number[] }
  if (!entityIds || !Array.isArray(entityIds) || entityIds.length === 0) {
    throw createError({ statusCode: 400, message: 'entityIds array is required' })
  }

  // Verify encounter exists
  const encounter = db.prepare(
    'SELECT id FROM encounters WHERE id = ? AND deleted_at IS NULL',
  ).get(encounterId)

  if (!encounter) {
    throw createError({ statusCode: 404, message: 'Encounter not found' })
  }

  // Get current max sort_order
  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM encounter_participants WHERE encounter_id = ?',
  ).get(encounterId) as { max_order: number }
  let sortOrder = maxOrder.max_order + 1

  const insertStmt = db.prepare(`
    INSERT INTO encounter_participants (encounter_id, entity_id, display_name, duplicate_index, current_hp, max_hp, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const insertMany = db.transaction(() => {
    for (const entityId of entityIds) {
      // Look up entity
      const entity = db.prepare(`
        SELECT e.id, e.name, et.name as type_name, e.image_url
        FROM entities e
        JOIN entity_types et ON et.id = e.type_id
        WHERE e.id = ? AND e.deleted_at IS NULL
      `).get(entityId) as EntityRow | undefined

      if (!entity) continue

      // Count existing participants with same entity_id for duplicate_index
      const dupCount = db.prepare(
        'SELECT COUNT(*) as cnt FROM encounter_participants WHERE encounter_id = ? AND entity_id = ?',
      ).get(encounterId, entityId) as { cnt: number }

      // Try to extract HP from entity_stats resource field named "hp"
      let currentHp = 0
      let maxHp = 0

      const stats = db.prepare(
        'SELECT es.values_json FROM entity_stats es WHERE es.entity_id = ?',
      ).get(entityId) as StatRow | undefined

      if (stats) {
        try {
          const values = JSON.parse(stats.values_json || '{}')
          // Look for a resource field named "hp" in the template
          const statLink = db.prepare(
            'SELECT template_id FROM entity_stats WHERE entity_id = ?',
          ).get(entityId) as { template_id: number } | undefined

          if (statLink) {
            const hpField = db.prepare(`
              SELECT name, field_type FROM stat_template_fields
              WHERE template_id = ? AND field_type = 'resource' AND LOWER(name) = 'hp'
            `).get(statLink.template_id) as FieldRow | undefined

            if (hpField && values[hpField.name]) {
              const res = values[hpField.name]
              if (typeof res === 'object' && 'current' in res && 'max' in res) {
                currentHp = Number(res.current) || 0
                maxHp = Number(res.max) || 0
              }
            }
          }
        }
        catch {
          // Ignore JSON parse errors
        }
      }

      insertStmt.run(
        encounterId,
        entityId,
        entity.name,
        dupCount.cnt,
        currentHp,
        maxHp,
        sortOrder++,
      )
    }
  })

  insertMany()

  // Return updated encounter with participants (reuse GET pattern)
  const updatedEncounter = db.prepare(`
    SELECT id, campaign_id, session_id, name, status, round, current_turn_index,
      created_at, updated_at, finished_at
    FROM encounters
    WHERE id = ? AND deleted_at IS NULL
  `).get(encounterId) as Record<string, unknown>

  const participants = db.prepare(`
    SELECT
      ep.id, ep.encounter_id, ep.entity_id, ep.display_name, ep.duplicate_index,
      ep.initiative, ep.current_hp, ep.max_hp, ep.temp_hp, ep.sort_order, ep.is_ko, ep.notes,
      et.name as entity_type,
      e.image_url as entity_image
    FROM encounter_participants ep
    LEFT JOIN entities e ON e.id = ep.entity_id
    LEFT JOIN entity_types et ON et.id = e.type_id
    WHERE ep.encounter_id = ?
    ORDER BY ep.sort_order ASC
  `).all(encounterId)

  return { ...updatedEncounter, participants }
})
