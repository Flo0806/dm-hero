import { getDb } from '../../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const encounterId = getRouterParam(event, 'id')
  const participantId = getRouterParam(event, 'participantId')
  const body = await readBody(event)

  if (!encounterId || !participantId) {
    throw createError({ statusCode: 400, message: 'Encounter ID and Participant ID are required' })
  }

  const { initiative, current_hp, max_hp, temp_hp, is_ko, notes, sort_order } = body

  db.prepare(`
    UPDATE encounter_participants
    SET
      initiative = COALESCE(?, initiative),
      current_hp = COALESCE(?, current_hp),
      max_hp = COALESCE(?, max_hp),
      temp_hp = COALESCE(?, temp_hp),
      is_ko = COALESCE(?, is_ko),
      notes = COALESCE(?, notes),
      sort_order = COALESCE(?, sort_order)
    WHERE id = ? AND encounter_id = ?
  `).run(
    initiative ?? null,
    current_hp ?? null,
    max_hp ?? null,
    temp_hp ?? null,
    is_ko != null ? (is_ko ? 1 : 0) : null,
    notes ?? null,
    sort_order ?? null,
    participantId,
    encounterId,
  )

  const participant = db.prepare(`
    SELECT
      ep.id, ep.encounter_id, ep.entity_id, ep.display_name, ep.duplicate_index,
      ep.initiative, ep.current_hp, ep.max_hp, ep.temp_hp, ep.sort_order, ep.is_ko, ep.notes,
      et.name as entity_type,
      e.image_url as entity_image
    FROM encounter_participants ep
    LEFT JOIN entities e ON e.id = ep.entity_id
    LEFT JOIN entity_types et ON et.id = e.type_id
    WHERE ep.id = ? AND ep.encounter_id = ?
  `).get(participantId, encounterId)

  if (!participant) {
    throw createError({ statusCode: 404, message: 'Participant not found' })
  }

  return participant
})
