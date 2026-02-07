import { getDb } from '../../../../utils/db'

interface EntityRow {
  id: number
  name: string
  type_name: string
  image_url: string | null
}

interface ParticipantInput {
  entityId: number
  currentHp?: number
  maxHp?: number
}

export default defineEventHandler(async (event) => {
  const db = getDb()
  const encounterId = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!encounterId) {
    throw createError({ statusCode: 400, message: 'Encounter ID is required' })
  }

  // Support both formats: { entityIds: number[] } or { participants: ParticipantInput[] }
  let inputs: ParticipantInput[]

  if (body.participants && Array.isArray(body.participants)) {
    inputs = body.participants
  }
  else if (body.entityIds && Array.isArray(body.entityIds)) {
    inputs = body.entityIds.map((id: number) => ({ entityId: id }))
  }
  else {
    throw createError({ statusCode: 400, message: 'participants or entityIds array is required' })
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
    for (const input of inputs) {
      const entity = db.prepare(`
        SELECT e.id, e.name, et.name as type_name, e.image_url
        FROM entities e
        JOIN entity_types et ON et.id = e.type_id
        WHERE e.id = ? AND e.deleted_at IS NULL
      `).get(input.entityId) as EntityRow | undefined

      if (!entity) continue

      const dupCount = db.prepare(
        'SELECT COUNT(*) as cnt FROM encounter_participants WHERE encounter_id = ? AND entity_id = ?',
      ).get(encounterId, input.entityId) as { cnt: number }

      insertStmt.run(
        encounterId,
        input.entityId,
        entity.name,
        dupCount.cnt,
        input.currentHp ?? 0,
        input.maxHp ?? 0,
        sortOrder++,
      )
    }
  })

  insertMany()

  // Return updated encounter with participants
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
  `).all(encounterId) as Record<string, unknown>[]

  const effectsStmt = db.prepare('SELECT * FROM encounter_effects WHERE participant_id = ?')
  for (const p of participants) {
    p.effects = effectsStmt.all(p.id)
  }

  return { ...updatedEncounter, participants }
})
