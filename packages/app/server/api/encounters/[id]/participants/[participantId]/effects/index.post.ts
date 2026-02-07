import { getDb } from '../../../../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const participantId = getRouterParam(event, 'participantId')
  const body = await readBody(event)

  if (!participantId) {
    throw createError({ statusCode: 400, message: 'Participant ID is required' })
  }

  const { name, icon, duration_type, duration_rounds } = body

  if (!name?.trim()) {
    throw createError({ statusCode: 400, message: 'Effect name is required' })
  }

  const durationType = duration_type || 'infinite'
  const rounds = durationType === 'rounds' ? (duration_rounds ?? 1) : null

  const result = db.prepare(`
    INSERT INTO encounter_effects (participant_id, name, icon, duration_type, duration_rounds, remaining_rounds)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(participantId, name.trim(), icon || null, durationType, rounds, rounds)

  return db.prepare('SELECT * FROM encounter_effects WHERE id = ?').get(result.lastInsertRowid)
})
