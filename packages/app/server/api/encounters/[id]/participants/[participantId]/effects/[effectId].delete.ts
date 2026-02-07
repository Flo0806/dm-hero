import { getDb } from '../../../../../../utils/db'

export default defineEventHandler((event) => {
  const db = getDb()
  const effectId = getRouterParam(event, 'effectId')

  if (!effectId) {
    throw createError({ statusCode: 400, message: 'Effect ID is required' })
  }

  db.prepare('DELETE FROM encounter_effects WHERE id = ?').run(effectId)
  return { success: true }
})
