import { getDb } from '../../../utils/db'

export default defineEventHandler((event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Encounter ID is required',
    })
  }

  const encounter = db
    .prepare(
      `
    SELECT
      id, campaign_id, session_id, name, status, round, current_turn_index,
      created_at, updated_at, finished_at
    FROM encounters
    WHERE id = ? AND deleted_at IS NULL
  `,
    )
    .get(id)

  if (!encounter) {
    throw createError({
      statusCode: 404,
      message: 'Encounter not found',
    })
  }

  const participants = db
    .prepare(
      `
    SELECT
      ep.id,
      ep.encounter_id,
      ep.entity_id,
      ep.display_name,
      ep.duplicate_index,
      ep.initiative,
      ep.current_hp,
      ep.max_hp,
      ep.temp_hp,
      ep.sort_order,
      ep.is_ko,
      ep.notes,
      et.name as entity_type,
      e.image_url as entity_image
    FROM encounter_participants ep
    LEFT JOIN entities e ON e.id = ep.entity_id
    LEFT JOIN entity_types et ON et.id = e.type_id
    WHERE ep.encounter_id = ?
    ORDER BY ep.sort_order ASC
  `,
    )
    .all(id) as Record<string, unknown>[]

  // Load effects per participant
  const effectsStmt = db.prepare('SELECT * FROM encounter_effects WHERE participant_id = ?')
  for (const p of participants) {
    p.effects = effectsStmt.all(p.id)
  }

  return { ...encounter, participants }
})
