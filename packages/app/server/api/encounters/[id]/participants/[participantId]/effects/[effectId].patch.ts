import { getDb } from '../../../../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const effectId = getRouterParam(event, 'effectId')
  const body = await readBody(event)

  if (!effectId) {
    throw createError({ statusCode: 400, message: 'Effect ID is required' })
  }

  const { remaining_rounds } = body

  db.prepare('UPDATE encounter_effects SET remaining_rounds = ? WHERE id = ?')
    .run(remaining_rounds ?? null, effectId)

  return db.prepare('SELECT * FROM encounter_effects WHERE id = ?').get(effectId)
})
