import { getDb } from '../../../../utils/db'

export default defineEventHandler((event) => {
  const db = getDb()
  const encounterId = getRouterParam(event, 'id')
  const participantId = getRouterParam(event, 'participantId')

  if (!encounterId || !participantId) {
    throw createError({ statusCode: 400, message: 'Encounter ID and Participant ID are required' })
  }

  // Hard-delete (join table row, not an entity)
  const result = db.prepare(
    'DELETE FROM encounter_participants WHERE id = ? AND encounter_id = ?',
  ).run(participantId, encounterId)

  if (result.changes === 0) {
    throw createError({ statusCode: 404, message: 'Participant not found' })
  }

  return { success: true }
})
